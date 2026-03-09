from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import RootModel

from apps.assignment.models import (
    Assignment,
    Attempt,
    PerformanceLevel,
    Question,
    QuestionPool,
    Rubric,
    RubricCriterion,
)
from apps.common.error import ErrorCode
from apps.common.schema import (
    FileSizeValidator,
    FileTypeValidator,
    GradeWorkflowMixinSchema,
    LearningObjectMixinSchema,
    Schema,
)
from apps.common.util import HttpRequest, ModeChoices
from apps.studio.decorator import editor_required, track_editing


class AssignmentQuestionSaveSpec(Schema):
    id: Annotated[int, Field(None)]
    question: str
    supplement: str
    attachment_file_count: int
    attachment_file_types: list[str]
    plagiarism_threshold: int


class AssignmentQuestionSpec(AssignmentQuestionSaveSpec):
    id: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class AssignmentQuestionsSaveSpec(Schema):
    data: list[AssignmentQuestionSaveSpec]


class AssignmentQuestionsSpec(RootModel[list[AssignmentQuestionSpec]]):
    pass


class RubricCriterionSpec(Schema):
    name: str
    description: str
    performance_levels: "list[PerformanceLevelSchema]"


class PerformanceLevelSchema(Schema):
    name: str
    description: str
    point: int


class AssignmentSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    id: str
    honor_code_id: int
    rubric_criteria: list[RubricCriterionSpec]
    questions: AssignmentQuestionsSpec
    sample_attachment: str | None

    @staticmethod
    def resolve_rubric_criteria(obj: Assignment):
        if not obj.rubric_data:
            return []
        return obj.rubric_data["criteria"]

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
    assignment = (
        await Assignment.objects
        .prefetch_related(
            Prefetch(
                "question_pool__questions", queryset=Question.objects.prefetch_related("attachments").order_by("id")
            )
        )
        .prefetch_related(
            Prefetch("rubric__rubric_criteria__performance_levels", queryset=PerformanceLevel.objects.order_by("point"))
        )
        .aget(id=id, owner_id=request.auth)
    )
    assignment.rubric_data = await assignment.get_rubric_data()

    return assignment


@router.post("/assignment", response=str)
@editor_required()
@track_editing(Assignment)
async def save_assignment(
    request: HttpRequest,
    data: AssignmentSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
    sample_attachment: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB", alias="sampleAttachment"),
    ],
):
    assignment_dict = data.model_dump(exclude_unset=True)
    assignment_id = assignment_dict.pop("id", None)

    if thumbnail:
        assignment_dict["thumbnail"] = thumbnail

    if sample_attachment:
        assignment_dict["sample_attachment"] = sample_attachment

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
                rubric = Rubric.objects.create(name=data.title)
                assignment = Assignment.objects.create(
                    **assignment_dict, question_pool=pool, rubric=rubric, owner_id=request.auth
                )
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return assignment

        assignment = await create_new()

    return assignment.id


@router.delete("/assignment/{id}")
@editor_required()
@track_editing(Assignment, id_field="id")
async def delete_assignment(request: HttpRequest, id: str):
    if await Attempt.objects.filter(assignment_id=id, mode=ModeChoices.NORMAL).aexists():
        raise ValueError(ErrorCode.ATTEMPT_EXISTS)
    await Assignment.objects.filter(id=id, owner_id=request.auth, published__isnull=True).adelete()


@router.get("/assignment/{id}/question", response=list[AssignmentQuestionSpec])
@editor_required()
async def get_assignment_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects.prefetch_related("attachments").filter(
            pool__assignment__id=id, pool__assignment__owner_id=request.auth
        )
    ]


@router.post("/assignment/{id}/question", response=list[int])
@editor_required()
@track_editing(Assignment, id_field="id")
async def save_assignment_questions(
    request: HttpRequest,
    id: str,
    data: AssignmentQuestionsSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    assignment = await aget_object_or_404(Assignment, id=id, owner_id=request.auth)
    questions, is_new = [], []

    dumped = data.model_dump()["data"]
    for question_data in dumped:
        is_new.append(not question_data["id"])

        if not question_data["id"]:
            question_data["id"] = None

        question = Question(pool_id=assignment.question_pool_id, **question_data)
        questions.append(question)

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=[
            "question",
            "supplement",
            "attachment_file_count",
            "attachment_file_types",
            "plagiarism_threshold",
        ],
    )

    for question, new in zip(questions, is_new):
        if new:
            question._prefetched_objects_cache = {"attachments": []}
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]


@router.delete("/assignment/{id}/question/{question_id}")
@editor_required()
@track_editing(Assignment, id_field="id")
async def delete_assignment_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        assignment_id=id, question=question_id, assignment__owner_id=request.auth, mode=ModeChoices.NORMAL
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__assignment__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)


@router.get("/assignment/{id}/rubric", response=list[RubricCriterionSpec])
@editor_required()
async def get_assignment_rubric(request: HttpRequest, id: str):
    assignment = await aget_object_or_404(
        Assignment.objects.prefetch_related("rubric__rubric_criteria__performance_levels"), id=id, owner_id=request.auth
    )
    return (await assignment.get_rubric_data())["criteria"]


@router.post("/assignment/{id}/rubric")
@editor_required()
@track_editing(Assignment, id_field="id")
async def save_assignment_rubric(request: HttpRequest, id: str, data: RootModel[list[RubricCriterionSpec]]):
    assignment = await aget_object_or_404(Assignment, id=id, owner_id=request.auth)

    @sync_to_async
    @transaction.atomic
    def update_rubric():
        RubricCriterion.objects.filter(rubric_id=assignment.rubric_id).delete()

        criteria_data = data.model_dump()
        criteria = RubricCriterion.objects.bulk_create([
            RubricCriterion(rubric_id=assignment.rubric_id, **{k: v for k, v in c.items() if k != "performance_levels"})
            for c in criteria_data
        ])

        PerformanceLevel.objects.bulk_create([
            PerformanceLevel(criterion=criterion, **level)
            for criterion, c in zip(criteria, criteria_data)
            for level in c["performance_levels"]
        ])

    await update_rubric()
