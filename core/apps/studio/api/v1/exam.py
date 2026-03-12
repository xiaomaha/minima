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
from apps.common.util import HttpRequest, RealmChoices
from apps.exam.models import Attempt, Exam, Question, QuestionPool, Solution
from apps.studio.decorator import editor_required, track_editing


class ExamQuestionSaveSpec(Schema):
    class ExamQuestionSolutionSpec(Schema):
        correct_answers: list[str]
        correct_criteria: str
        explanation: str

    id: Annotated[int, Field(None)]
    format: Question.ExamQuestionFormatChoices
    question: str
    supplement: str
    options: list[str]
    point: int
    solution: ExamQuestionSolutionSpec


class ExamQuestionSpec(ExamQuestionSaveSpec):
    id: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class ExamQuestionsSaveSpec(Schema):
    data: list[ExamQuestionSaveSpec]


class ExamQuestionsSpec(RootModel[list[ExamQuestionSpec]]):
    pass


class ExamSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    class ExamQuestionPoolSpec(Schema):
        composition: dict[Question.ExamQuestionFormatChoices, int]

    id: str
    duration_seconds: float
    honor_code_id: int
    question_pool: ExamQuestionPoolSpec
    questions: ExamQuestionsSpec

    @staticmethod
    def resolve_questions(obj: Exam):
        return obj.question_pool.questions.all()


class ExamSaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    duration_seconds: float
    passing_point: int
    max_attempts: int
    verification_required: bool
    grade_due_days: int
    appeal_deadline_days: int
    confirm_due_days: int
    honor_code_id: int
    question_pool: ExamSpec.ExamQuestionPoolSpec


router = Router(by_alias=True)


@router.get("/exam/{id}", response=ExamSpec)
@editor_required()
async def get_exam(request: HttpRequest, id: str):
    return (
        await Exam.objects
        .select_related("question_pool")
        .prefetch_related(
            Prefetch(
                "question_pool__questions",
                queryset=Question.objects.prefetch_related("attachments").select_related("solution").order_by("id"),
            )
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/exam", response=str)
@editor_required()
@track_editing(Exam)
async def save_exam(
    request: HttpRequest,
    data: ExamSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    exam_dict = data.model_dump(exclude_unset=True)
    exam_id = exam_dict.pop("id", None)
    question_pool = exam_dict.pop("question_pool")

    if thumbnail:
        exam_dict["thumbnail"] = thumbnail

    if exam_id:
        exam = await aget_object_or_404(Exam, id=exam_id, owner_id=request.auth)
        for key, value in exam_dict.items():
            setattr(exam, key, value)
        await exam.asave()
        await QuestionPool.objects.filter(id=exam.question_pool_id).aupdate(**question_pool)

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            try:
                pool = QuestionPool.objects.create(**question_pool, owner_id=request.auth, title=data.title)
                exam = Exam.objects.create(**exam_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return exam

        exam = await create_new()

    return exam.id


@router.delete("/exam/{id}")
@editor_required()
@track_editing(Exam, id_field="id")
async def delete_exam(request: HttpRequest, id: str):
    if await Attempt.objects.filter(exam_id=id, realm=RealmChoices.STUDENT).aexists():
        raise ValueError(ErrorCode.ATTEMPT_EXISTS)
    await Exam.objects.filter(id=id, owner_id=request.auth, published__isnull=True).adelete()


@router.get("/exam/{id}/question", response=list[ExamQuestionSpec])
@editor_required()
async def get_exam_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects
        .select_related("solution")
        .prefetch_related("attachments")
        .filter(pool__exam__id=id, pool__exam__owner_id=request.auth)
    ]


@router.post("/exam/{id}/question", response=list[int])
@editor_required()
@track_editing(Exam, id_field="id")
async def save_exam_questions(
    request: HttpRequest,
    id: str,
    data: ExamQuestionsSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    exam = await aget_object_or_404(Exam, id=id, owner_id=request.auth)
    questions, solutions, is_new = [], [], []

    dumped = data.model_dump()["data"]
    for question_data in dumped:
        is_new.append(not question_data["id"])

        if not question_data["id"]:
            question_data["id"] = None

        solution_data = question_data.pop("solution")
        solution_data["correct_answers"] = [x for x in solution_data["correct_answers"] if x.strip()]

        question = Question(pool_id=exam.question_pool_id, **question_data)
        questions.append(question)
        solutions.append(Solution(question=question, **solution_data))

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=["format", "question", "supplement", "options", "point"],
    )

    await Solution.objects.abulk_create(
        solutions,
        update_conflicts=True,
        unique_fields=["question_id"],
        update_fields=["correct_answers", "correct_criteria", "explanation"],
    )

    for question, new in zip(questions, is_new):
        if new:
            question._prefetched_objects_cache = {"attachments": []}
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]


@router.delete("/exam/{id}/question/{question_id}")
@editor_required()
@track_editing(Exam, id_field="id")
async def delete_exam_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        exam_id=id, questions=question_id, exam__owner_id=request.auth, realm=RealmChoices.STUDENT
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__exam__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
