from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
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
from apps.studio.decorator import editor_required, track_draft


class AssignmentQuestionSaveSpec(Schema):
    id: Annotated[int, Field(None)]
    question: str
    supplement: str
    attachment_file_count: int
    attachment_file_types: list[str]
    plagiarism_threshold: int


class AssignmentQuestionSpec(AssignmentQuestionSaveSpec):
    id: int
    sample_attachment: str | None

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


class AssignmentQuestionsSaveSpec(RootModel[list[AssignmentQuestionSaveSpec]]):
    pass


class AssignmentQuestionsSpec(RootModel[list[AssignmentQuestionSpec]]):
    pass


class AssignmentSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    id: str
    honor_code_id: int
    questions: AssignmentQuestionsSpec

    @staticmethod
    def resolve_questions(obj: Assignment):
        return obj.question_pool.questions.all()


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
    honor_code_id: int


router = Router(by_alias=True)


@router.get("/assignment/{id}", response=AssignmentSpec)
@editor_required()
async def get_assignment(request: HttpRequest, id: str):
    assignment = await Assignment.objects.prefetch_related(
        Prefetch("question_pool__questions", queryset=Question.objects.prefetch_related("attachments").order_by("id"))
    ).aget(id=id, owner_id=request.auth)

    return assignment


@router.post("/assignment", response=str)
@editor_required()
@track_draft(Assignment)
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

    if thumbnail:
        assignment_dict["thumbnail"] = thumbnail

    if assignment_id:
        assignment = await aget_object_or_404(Assignment, id=assignment_id, owner_id=request.auth)
        for key, value in assignment_dict.items():
            setattr(assignment, key, value)
        await assignment.asave()

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            try:
                pool = QuestionPool.objects.create(owner_id=request.auth, title=data.title)
                assignment = Assignment.objects.create(**assignment_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return assignment

        assignment = await create_new()

    return assignment.id


@router.get("/assignment/{id}/question", response=list[AssignmentQuestionSpec])
@editor_required()
async def get_assignment_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects
        .select_related("solution")
        .prefetch_related("attachments")
        .filter(pool__assignment__id=id, pool__assignment__owner_id=request.auth)
    ]


@router.post("/assignment/{id}/question", response=int)
@editor_required()
@track_draft(Assignment, id_field="id")
async def save_assignment_question(
    request: HttpRequest,
    id: str,
    data: AssignmentQuestionSaveSpec,
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
        id=None if not data.id else data.id, pool_id=assignment.question_pool_id, defaults=defaults
    )

    await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return question.pk


@router.delete("/assignment/{id}/question/{question_id}")
@editor_required()
@track_draft(Assignment, id_field="id")
async def delete_assignment_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        assignment_id=id, question=question_id, assignment__owner_id=request.auth
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__assignment__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
