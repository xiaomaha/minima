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
from apps.exam.models import Attempt, Exam, Question, QuestionPool, Solution
from apps.operation.models import HonorCode
from apps.studio.api.v1.schema import HonorCodeSpec, OwnerSpec
from apps.studio.decorator import editor_required, track_draft
from apps.studio.models import Draft


class ExamQuestionSaveSpec(Schema):
    class ExamQuestionSolutionSpec(Schema):
        correct_answers: list[str]
        correct_criteria: str
        explanation: str

    id: int
    format: Question.ExamQuestionFormatChoices
    question: str
    supplement: str
    options: list[str]
    point: int
    solution: ExamQuestionSolutionSpec


class ExamQuestionSpec(ExamQuestionSaveSpec):
    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class ExamQuestionSetSaveSpec(Schema):
    data: list[ExamQuestionSaveSpec]


class ExamQuestionSetSpec(RootModel[list[ExamQuestionSpec]]):
    pass


class ExamSpec(LearningObjectMixinSchema, GradeWorkflowMixinSchema):
    class ExamQuestionPoolSpec(Schema):
        description: str
        composition: dict[Question.ExamQuestionFormatChoices, int]

    id: str
    duration_seconds: float

    owner: OwnerSpec
    honor_code: HonorCodeSpec
    question_pool: ExamQuestionPoolSpec
    question_set: ExamQuestionSetSpec

    @staticmethod
    def resolve_question_set(obj: Exam):
        return obj.question_pool.question_set.all()


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
    honor_code: HonorCodeSpec
    question_pool: ExamSpec.ExamQuestionPoolSpec


router = Router(by_alias=True)


@router.get("/exam/{id}", response=ExamSpec)
@editor_required()
async def get_exam(request: HttpRequest, id: str):
    return (
        await Exam.objects
        .select_related("owner", "honor_code", "question_pool")
        .prefetch_related(
            Prefetch(
                "question_pool__question_set",
                queryset=Question.objects.prefetch_related("attachments").select_related("solution"),
            )
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/exam", response=str)
@editor_required()
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
    honor_code = exam_dict.pop("honor_code")
    question_pool = exam_dict.pop("question_pool")

    if thumbnail:
        exam_dict["thumbnail"] = thumbnail

    if exam_id:
        exam = await aget_object_or_404(Exam, id=exam_id, owner_id=request.auth)
        for key, value in exam_dict.items():
            setattr(exam, key, value)
        await exam.asave()
        await HonorCode.objects.filter(id=exam.honor_code_id).aupdate(**honor_code)
        await QuestionPool.objects.filter(id=exam.question_pool_id).aupdate(**question_pool)

    else:

        @sync_to_async
        @transaction.atomic
        def create_new():
            code = HonorCode.objects.create(**honor_code)
            try:
                pool = QuestionPool.objects.create(**question_pool, owner_id=request.auth, title=data.title)
                exam = Exam.objects.create(**exam_dict, honor_code=code, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                # both title conflict
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return exam

        exam = await create_new()

    content_type = await sync_to_async(ContentType.objects.get_for_model)(Exam)
    await Draft.objects.aupdate_or_create(
        content_type=content_type, content_id=exam.id, defaults={"author_id": request.auth}
    )

    return exam.id


@router.post("/exam/{id}/question", response=int)
@editor_required()
@track_draft(Exam, id_field="id")
async def save_exam_question(
    request: HttpRequest,
    id: str,
    data: ExamQuestionSaveSpec,  # form doesn't work nested model
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    exam = await aget_object_or_404(Exam, id=id, owner_id=request.auth)
    question, _ = await Question.objects.aupdate_or_create(
        id=None if data.id <= 0 else data.id,
        pool_id=exam.question_pool_id,
        defaults={
            "format": data.format,
            "question": data.question,
            "supplement": data.supplement,
            "options": data.options,
            "point": data.point,
        },
    )
    await Solution.objects.aupdate_or_create(
        question_id=question.id,
        defaults={
            "correct_answers": [x for x in data.solution.correct_answers if x.strip()],
            "correct_criteria": data.solution.correct_criteria,
            "explanation": data.solution.explanation,
        },
    )
    await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)
    return question.pk


@router.delete("/exam/{id}/question/{q}")
@editor_required()
@track_draft(Exam, id_field="id")
async def delete_exam_quesion(request: HttpRequest, id: str, q: int):
    if await Attempt.objects.filter(exam_id=id, questions=q).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=q, pool__exam__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)


@router.post("/exam/{id}/questionset", response=list[int])
@editor_required()
@track_draft(Exam, id_field="id")
async def save_exam_questions(
    request: HttpRequest,
    id: str,
    data: ExamQuestionSetSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    exam = await aget_object_or_404(Exam, id=id, owner_id=request.auth)
    questions, solutions = [], []

    for question_data in data.model_dump()["data"]:
        if question_data["id"] <= 0:
            question_data["id"] = None

        solution_data = question_data.pop("solution")
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

    for question in questions:
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]
