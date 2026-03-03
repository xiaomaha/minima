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
from apps.operation.models import HonorCode
from apps.studio.api.v1.schema import HonorCodeSpec
from apps.studio.decorator import editor_required, track_draft


class DiscussionQuestionSaveSpec(Schema):
    id: int
    directive: str
    supplement: str
    post_point: int
    reply_point: int
    tutor_assessment_point: int
    post_min_characters: int
    reply_min_characters: int


class DiscussionQuestionSpec(DiscussionQuestionSaveSpec):
    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


class DiscussionQuestionsSaveSpec(RootModel[list[DiscussionQuestionSaveSpec]]):
    pass


class DiscussionQuestionsSpec(RootModel[list[DiscussionQuestionSpec]]):
    pass


class DiscussionSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    class DiscussionQuestionPoolSpec(Schema):
        description: str

    id: str

    honor_code: HonorCodeSpec
    question_pool: DiscussionQuestionPoolSpec
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
    honor_code: HonorCodeSpec
    question_pool: DiscussionSpec.DiscussionQuestionPoolSpec


router = Router(by_alias=True)


@router.get("/discussion/{id}", response=DiscussionSpec)
@editor_required()
async def get_discussion(request: HttpRequest, id: str):
    return (
        await Discussion.objects
        .select_related("honor_code", "question_pool")
        .prefetch_related(
            Prefetch("question_pool__questions", queryset=Question.objects.prefetch_related("attachments"))
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/discussion", response=str)
@editor_required()
@track_draft(Discussion)
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
    honor_code = discussion_dict.pop("honor_code")
    question_pool = discussion_dict.pop("question_pool")

    if thumbnail:
        discussion_dict["thumbnail"] = thumbnail

    if discussion_id:
        discussion = await aget_object_or_404(Discussion, id=discussion_id, owner_id=request.auth)
        for key, value in discussion_dict.items():
            setattr(discussion, key, value)
        await discussion.asave()
        await HonorCode.objects.filter(id=discussion.honor_code_id).aupdate(**honor_code)
        await QuestionPool.objects.filter(id=discussion.question_pool_id).aupdate(**question_pool)

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            code = HonorCode.objects.create(**honor_code)
            try:
                pool = QuestionPool.objects.create(**question_pool, owner_id=request.auth, title=data.title)
                discussion = Discussion.objects.create(
                    **discussion_dict, honor_code=code, question_pool=pool, owner_id=request.auth
                )
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return discussion

        discussion = await create_new()

    return discussion.id


@router.post("/discussion/{id}/question", response=int)
@editor_required()
@track_draft(Discussion, id_field="id")
async def save_discussion_question(
    request: HttpRequest,
    id: str,
    data: DiscussionQuestionSaveSpec,  # form doesn't work nested model
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    discussion = await aget_object_or_404(Discussion, id=id, owner_id=request.auth)
    question, _ = await Question.objects.aupdate_or_create(
        id=None if not data.id else data.id,
        pool_id=discussion.question_pool_id,
        defaults={
            "directive": data.directive,
            "supplement": data.supplement,
            "post_point": data.post_point,
            "reply_point": data.reply_point,
            "tutor_assessment_point": data.tutor_assessment_point,
            "post_min_characters": data.post_min_characters,
            "reply_min_characters": data.reply_min_characters,
        },
    )
    await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)
    return question.pk


@router.delete("/discussion/{id}/question/{question_id}")
@editor_required()
@track_draft(Discussion, id_field="id")
async def delete_discussion_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        discussion_id=id, question_id=question_id, discussion__owner_id=request.auth
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__discussion__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
