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
from apps.common.schema import (
    FileSizeValidator,
    FileTypeValidator,
    GradeWorkflowMixinSchema,
    LearningObjectMixinSchema,
    Schema,
)
from apps.common.util import HttpRequest
from apps.discussion.models import Attempt, Discussion, Question, QuestionPool
from apps.studio.decorator import track_editing


class DiscussionQuestionSaveSpec(Schema):
    id: Annotated[int, Field(None)]
    directive: str
    supplement: str
    post_point: int
    reply_point: int
    tutor_assessment_point: int
    post_min_characters: int
    reply_min_characters: int


class DiscussionQuestionSpec(DiscussionQuestionSaveSpec):
    id: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class DiscussionQuestionsSaveSpec(Schema):
    data: list[DiscussionQuestionSaveSpec]


class DiscussionQuestionsSpec(RootModel[list[DiscussionQuestionSpec]]):
    pass


class DiscussionSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    id: str

    honor_code_id: int
    questions: DiscussionQuestionsSpec

    @staticmethod
    def resolve_questions(obj: Discussion):
        return obj.question_pool.questions.all()


class DiscussionSaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    passing_point: int
    max_attempts: int
    verification_required: bool
    grade_due_days: int
    appeal_deadline_days: int
    confirm_due_days: int
    honor_code_id: int


router = Router(by_alias=True)


@router.get("/discussion/{id}", response=DiscussionSpec)
async def get_discussion(request: HttpRequest, id: str):
    return await Discussion.objects.prefetch_related(
        Prefetch("question_pool__questions", queryset=Question.objects.prefetch_related("attachments").order_by("id"))
    ).aget(id=id, owner_id=request.auth)


@router.post("/discussion", response=str)
@track_editing(Discussion)
async def save_discussion(
    request: HttpRequest,
    data: DiscussionSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    discussion_dict = data.model_dump(exclude_unset=True)
    discussion_id = discussion_dict.pop("id", None)

    if thumbnail:
        discussion_dict["thumbnail"] = thumbnail

    if discussion_id:
        discussion = await aget_object_or_404(Discussion, id=discussion_id, owner_id=request.auth)
        for key, value in discussion_dict.items():
            setattr(discussion, key, value)
        await discussion.asave()

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            try:
                pool = QuestionPool.objects.create(owner_id=request.auth, title=data.title)
                discussion = Discussion.objects.create(**discussion_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return discussion

        discussion = await create_new()

    return discussion.id


@router.delete("/discussion/{id}")
@track_editing(Discussion, id_field="id")
async def delete_discussion(request: HttpRequest, id: str):
    if await Attempt.objects.filter(discussion_id=id).aexists():
        raise ValueError(ErrorCode.ATTEMPT_EXISTS)
    await Discussion.objects.filter(id=id, owner_id=request.auth, published__isnull=True).adelete()


@router.get("/discussion/{id}/question", response=list[DiscussionQuestionSpec])
async def get_discussion_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects.prefetch_related("attachments").filter(
            pool__discussion__id=id, pool__discussion__owner_id=request.auth
        )
    ]


@router.post("/discussion/{id}/question", response=list[int])
@track_editing(Discussion, id_field="id")
async def save_discussion_questions(
    request: HttpRequest,
    id: str,
    data: DiscussionQuestionsSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    discussion = await aget_object_or_404(Discussion, id=id, owner_id=request.auth)
    questions, is_new = [], []

    dumped = data.model_dump()["data"]
    for question_data in dumped:
        is_new.append(not question_data["id"])

        if not question_data["id"]:
            question_data["id"] = None

        question = Question(pool_id=discussion.question_pool_id, **question_data)
        questions.append(question)

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=[
            "directive",
            "supplement",
            "post_point",
            "reply_point",
            "tutor_assessment_point",
            "post_min_characters",
            "reply_min_characters",
        ],
    )

    for question, new in zip(questions, is_new):
        if new:
            question._prefetched_objects_cache = {"attachments": []}
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]


@router.delete("/discussion/{id}/question/{question_id}")
@track_editing(Discussion, id_field="id")
async def delete_discussion_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        discussion_id=id, question_id=question_id, discussion__owner_id=request.auth
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__discussion__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
