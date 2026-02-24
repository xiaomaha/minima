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

from apps.assignment.models import Assignment, Attempt, Question, QuestionPool
from apps.common.error import ErrorCode
from apps.common.schema import (
    FileSizeValidator,
    FileTypeValidator,
    GradeWorkflowMixinSchema,
    LearningObjectMixinSchema,
    Schema,
)
from apps.common.util import HttpRequest
from apps.operation.models import HonorCode
from apps.studio.api.v1.schema import HonorCodeSpec, OwnerSpec
from apps.studio.decorator import editor_required, track_draft
from apps.studio.models import Draft


class AssignmentQuestionSaveSpec(Schema):
    id: int
    question: str
    supplement: str
    attachment_file_count: int
    attachment_file_types: list[str]
    plagiarism_threshold: int


class AssignmentQuestionSpec(AssignmentQuestionSaveSpec):
    sample_attachment: str | None

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


class AssignmentQuestionSetSaveSpec(RootModel[list[AssignmentQuestionSaveSpec]]):
    pass


class AssignmentQuestionSetSpec(RootModel[list[AssignmentQuestionSpec]]):
    pass


class AssignmentSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    class AssignmentQuestionPoolSpec(Schema):
        description: str

    id: str
    owner: OwnerSpec
    honor_code: HonorCodeSpec
    question_pool: AssignmentQuestionPoolSpec
    question_set: AssignmentQuestionSetSpec

    @staticmethod
    def resolve_question_set(obj: Assignment):
        return obj.question_pool.question_set.all()


class AssignmentSaveSpec(Schema):
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
    question_pool: AssignmentSpec.AssignmentQuestionPoolSpec


router = Router(by_alias=True)


@router.get("/assignment/{id}", response=AssignmentSpec)
@editor_required()
async def get_assignment(request: HttpRequest, id: str):
    assignment = (
        await Assignment.objects
        .select_related("owner", "honor_code", "question_pool")
        .prefetch_related(
            Prefetch("question_pool__question_set", queryset=Question.objects.prefetch_related("attachments"))
        )
        .aget(id=id, owner_id=request.auth)
    )

    return assignment


@router.post("/assignment", response=str)
@editor_required()
async def save_assignment(
    request: HttpRequest,
    data: AssignmentSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    assignment_dict = data.model_dump(exclude_unset=True)
    assignment_id = assignment_dict.pop("id", None)
    honor_code = assignment_dict.pop("honor_code")
    question_pool = assignment_dict.pop("question_pool")

    if thumbnail:
        assignment_dict["thumbnail"] = thumbnail

    if assignment_id:
        assignment = await aget_object_or_404(Assignment, id=assignment_id, owner_id=request.auth)
        for key, value in assignment_dict.items():
            setattr(assignment, key, value)
        await assignment.asave()
        await HonorCode.objects.filter(id=assignment.honor_code_id).aupdate(**honor_code)
        await QuestionPool.objects.filter(id=assignment.question_pool_id).aupdate(**question_pool)

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            code = HonorCode.objects.create(**honor_code)
            try:
                pool = QuestionPool.objects.create(**question_pool, owner_id=request.auth, title=data.title)
                assignment = Assignment.objects.create(
                    **assignment_dict, honor_code=code, question_pool=pool, owner_id=request.auth
                )
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return assignment

        assignment = await create_new()

    content_type = await sync_to_async(ContentType.objects.get_for_model)(Assignment)
    await Draft.objects.aupdate_or_create(
        content_type=content_type, content_id=assignment.id, defaults={"author_id": request.auth}
    )

    return assignment.id


@router.post("/assignment/{id}/question", response=int)
@editor_required()
@track_draft(Assignment, id_field="id")
async def save_assignment_question(
    request: HttpRequest,
    id: str,
    data: AssignmentQuestionSaveSpec,  # form doesn't work nested model
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
    sample: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    assignment = await aget_object_or_404(Assignment, id=id, owner_id=request.auth)
    defaults: dict = {
        "question": data.question,
        "supplement": data.supplement,
        "attachment_file_count": data.attachment_file_count,
        "attachment_file_types": data.attachment_file_types,
        "plagiarism_threshold": data.plagiarism_threshold,
    }

    if sample:
        defaults["sample_attachment"] = sample

    question, _ = await Question.objects.aupdate_or_create(
        id=None if data.id <= 0 else data.id, pool_id=assignment.question_pool_id, defaults=defaults
    )

    await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return question.pk


@router.delete("/assignment/{id}/question/{q}")
@editor_required()
@track_draft(Assignment, id_field="id")
async def delete_assignment_quesion(request: HttpRequest, id: str, q: int):
    if await Attempt.objects.filter(assignment_id=id, question=q).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=q, pool__assignment__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
