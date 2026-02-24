from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import RootModel

from apps.common.error import ErrorCode
from apps.common.schema import FileSizeValidator, FileTypeValidator, LearningObjectMixinSchema, Schema
from apps.common.util import HttpRequest
from apps.studio.api.v1.schema import OwnerSpec
from apps.studio.decorator import editor_required, track_draft
from apps.studio.models import Draft
from apps.survey.models import Question, QuestionPool, Survey


class SurveyQuestionSaveSpec(Schema):
    id: int
    format: Question.SurveyQuestionFormatChoices
    question: str
    supplement: str
    options: list[str]
    mandatory: bool
    ordering: int


class SurveyQuestionSpec(SurveyQuestionSaveSpec):
    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class SurveyQuestionSetSaveSpec(Schema):
    data: list[SurveyQuestionSaveSpec]


class SurveyQuestionSetSpec(RootModel[list[SurveyQuestionSpec]]):
    pass


class SurveySpec(LearningObjectMixinSchema):
    class SurveyQuestionPoolSpec(Schema):
        description: str

    id: str
    owner: OwnerSpec
    question_pool: SurveyQuestionPoolSpec
    question_set: SurveyQuestionSetSpec
    complete_message: str
    anonymous: bool
    show_results: bool

    @staticmethod
    def resolve_question_set(obj: Survey):
        return obj.question_pool.question_set.all()


class SurveySaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    question_pool: SurveySpec.SurveyQuestionPoolSpec
    complete_message: str
    anonymous: bool
    show_results: bool


router = Router(by_alias=True)


@router.get("/survey/{id}", response=SurveySpec)
@editor_required()
async def get_survey(request: HttpRequest, id: str):
    return (
        await Survey.objects
        .select_related("owner", "question_pool")
        .prefetch_related(
            Prefetch(
                "question_pool__question_set", queryset=Question.objects.prefetch_related("attachments").order_by("id")
            )
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/survey", response=str)
@editor_required()
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
    question_pool_data = survey_dict.pop("question_pool")

    if thumbnail:
        survey_dict["thumbnail"] = thumbnail

    if survey_id:
        survey = await aget_object_or_404(Survey, id=survey_id, owner_id=request.auth)
        for key, value in survey_dict.items():
            setattr(survey, key, value)
        await survey.asave()
        await QuestionPool.objects.filter(id=survey.question_pool_id).aupdate(**question_pool_data)

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            try:
                pool = QuestionPool.objects.create(**question_pool_data, owner_id=request.auth, title=data.title)
                survey = Survey.objects.create(**survey_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return survey

        survey = await create_new()

    content_type = await sync_to_async(ContentType.objects.get_for_model)(Survey)
    await Draft.objects.aupdate_or_create(
        content_type=content_type, content_id=survey.id, defaults={"author_id": request.auth}
    )

    return survey.id


@router.post("/survey/{id}/question", response=int)
@editor_required()
@track_draft(Survey, id_field="id")
async def save_survey_question(
    request: HttpRequest,
    id: str,
    data: SurveyQuestionSaveSpec,  # form doesn't work nested model
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    survey = await aget_object_or_404(Survey, id=id, owner_id=request.auth)
    question, _ = await Question.objects.aupdate_or_create(
        id=None if data.id <= 0 else data.id,
        pool_id=survey.question_pool_id,
        defaults={
            "format": data.format,
            "question": data.question,
            "supplement": data.supplement,
            "options": data.options,
            "mandatory": data.mandatory,
        },
    )
    await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)
    return question.pk


@router.delete("/survey/{id}/question/{q}")
@editor_required()
@track_draft(Survey, id_field="id")
async def delete_survey_quesion(request: HttpRequest, id: str, q: int):
    count, _ = await Question.objects.filter(id=q, pool__survey__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)


@router.post("/survey/{id}/questionset", response=list[int])
@editor_required()
@track_draft(Survey, id_field="id")
async def save_survey_questions(
    request: HttpRequest,
    id: str,
    data: SurveyQuestionSetSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    survey = await aget_object_or_404(Survey, id=id, owner_id=request.auth)
    questions = []

    for question_data in data.model_dump()["data"]:
        if question_data["id"] <= 0:
            question_data["id"] = None

        question = Question(pool_id=survey.question_pool_id, **question_data)
        questions.append(question)

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=["format", "question", "supplement", "options", "mandatory"],
    )

    for question in questions:
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]
