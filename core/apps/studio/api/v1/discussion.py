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
from apps.studio.api.v1.schema import HonorCodeSpec, OwnerSpec
from apps.studio.decorator import editor_required, track_draft
from apps.studio.models import Draft


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


class DiscussionQuestionSetSaveSpec(RootModel[list[DiscussionQuestionSaveSpec]]):
    pass


class DiscussionQuestionSetSpec(RootModel[list[DiscussionQuestionSpec]]):
    pass


class DiscussionSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    class DiscussionQuestionPoolSpec(Schema):
        description: str

    id: str

    owner: OwnerSpec
    honor_code: HonorCodeSpec
    question_pool: DiscussionQuestionPoolSpec
    question_set: DiscussionQuestionSetSpec

    @staticmethod
    def resolve_question_set(obj: Discussion):
        return obj.question_pool.question_set.all()


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
        .select_related("owner", "honor_code", "question_pool")
        .prefetch_related(
            Prefetch("question_pool__question_set", queryset=Question.objects.prefetch_related("attachments"))
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/discussion", response=str)
@editor_required()
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

    content_type = await sync_to_async(ContentType.objects.get_for_model)(Discussion)
    await Draft.objects.aupdate_or_create(
        content_type=content_type, content_id=discussion.id, defaults={"author_id": request.auth}
    )

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
        id=None if data.id <= 0 else data.id,
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


@router.delete("/discussion/{id}/question/{q}")
@editor_required()
@track_draft(Discussion, id_field="id")
async def delete_discussion_quesion(request: HttpRequest, id: str, q: int):
    if await Attempt.objects.filter(discussion_id=id, question_id=q).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=q, pool__discussion__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
