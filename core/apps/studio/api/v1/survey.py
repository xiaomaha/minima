from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import RootModel

from apps.common.error import ErrorCode
from apps.common.schema import FileSizeValidator, FileTypeValidator, LearningObjectMixinSchema, Schema
from apps.common.util import HttpRequest, RealmChoices
from apps.studio.decorator import editor_required, track_editing
from apps.survey.models import Question, QuestionPool, Submission, Survey


class SurveyQuestionSaveSpec(Schema):
    id: Annotated[int, Field(None)]
    format: Question.SurveyQuestionFormatChoices
    question: str
    supplement: str
    options: list[str]
    mandatory: bool
    ordering: int


class SurveyQuestionSpec(SurveyQuestionSaveSpec):
    id: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class SurveyQuestionsSaveSpec(Schema):
    data: list[SurveyQuestionSaveSpec]


class SurveyQuestionsSpec(RootModel[list[SurveyQuestionSpec]]):
    pass


class SurveySpec(LearningObjectMixinSchema):
    id: str
    questions: SurveyQuestionsSpec
    complete_message: str
    anonymous: bool
    show_results: bool

    @staticmethod
    def resolve_questions(obj: Survey):
        return obj.question_pool.questions.all()


class SurveySaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    complete_message: str
    anonymous: bool
    show_results: bool


router = Router(by_alias=True)


@router.get("/survey/{id}", response=SurveySpec)
@editor_required()
async def get_survey(request: HttpRequest, id: str):
    return await Survey.objects.prefetch_related(
        Prefetch("question_pool__questions", queryset=Question.objects.prefetch_related("attachments").order_by("id"))
    ).aget(id=id, owner_id=request.auth)


@router.post("/survey", response=str)
@editor_required()
@track_editing(Survey)
async def save_survey(
    request: HttpRequest,
    data: SurveySaveSpec,  # form doesn't work nested model
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    survey_dict = data.model_dump(exclude_unset=True)
    survey_id = survey_dict.pop("id", None)

    if thumbnail:
        survey_dict["thumbnail"] = thumbnail

    if survey_id:
        survey = await aget_object_or_404(Survey, id=survey_id, owner_id=request.auth)
        for key, value in survey_dict.items():
            setattr(survey, key, value)
        await survey.asave()

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            try:
                pool = QuestionPool.objects.create(owner_id=request.auth, title=data.title)
                survey = Survey.objects.create(**survey_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return survey

        survey = await create_new()

    return survey.id


@router.delete("/survey/{id}")
@editor_required()
@track_editing(Survey, id_field="id")
async def delete_survey(request: HttpRequest, id: str):
    if await Submission.objects.filter(survey_id=id, realm=RealmChoices.STUDENT).aexists():
        raise ValueError(ErrorCode.ATTEMPT_EXISTS)
    await Survey.objects.filter(id=id, owner_id=request.auth, published__isnull=True).adelete()


@router.get("/survey/{id}/question", response=list[SurveyQuestionSpec])
@editor_required()
async def get_survey_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects.prefetch_related("attachments").filter(
            pool__survey__id=id, pool__survey__owner_id=request.auth
        )
    ]


@router.post("/survey/{id}/question", response=list[int])
@editor_required()
@track_editing(Survey, id_field="id")
async def save_survey_questions(
    request: HttpRequest,
    id: str,
    data: SurveyQuestionsSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    survey = await aget_object_or_404(Survey, id=id, owner_id=request.auth)
    questions, is_new = [], []

    dumped = data.model_dump()["data"]
    for question_data in dumped:
        is_new.append(not question_data["id"])

        if not question_data["id"]:
            question_data["id"] = None

        question = Question(pool_id=survey.question_pool_id, **question_data)
        questions.append(question)

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=["format", "question", "supplement", "options", "mandatory"],
    )

    for question, new in zip(questions, is_new):
        if new:
            question._prefetched_objects_cache = {"attachments": []}
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]


@router.delete("/survey/{id}/question/{question_id}")
@editor_required()
@track_editing(Survey, id_field="id")
async def delete_survey_quesion(request: HttpRequest, id: str, question_id: int):
    count, _ = await Question.objects.filter(id=question_id, pool__survey__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
