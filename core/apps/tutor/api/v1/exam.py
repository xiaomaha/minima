from datetime import datetime
from typing import Annotated

from django.db.models import F, Prefetch, Q
from django.shortcuts import aget_object_or_404
from ninja import Field, Router
from ninja.pagination import paginate
from ninja.params import functions

from apps.account.api.schema import OwnerSchema
from apps.common.schema import Schema
from apps.common.util import HttpRequest, Pagination
from apps.exam.api.schema import ExamQuestionSchema, ExamSolutionSchema
from apps.exam.models import Exam, Grade, Question
from apps.tutor.api.v1.schema import TutorGradeSaveSchema, TutorGradeSchema, TutorGraeCompleteSchema
from apps.tutor.decorator import allocation_required
from apps.tutor.tasks import regrade_exam_question_task

router = Router(by_alias=True)


class TutorExamGradeSchema(TutorGradeSchema):
    @staticmethod
    def resolve_grading_date(grade: Grade):
        return grade.attempt.exam.get_grading_date(access_date={"end": grade.attempt.lock})


@router.get("/exam/{id}/grade", response=list[TutorExamGradeSchema])
@allocation_required("exam", "exam")
@paginate(Pagination)
async def get_exam_grades(request: HttpRequest, id: str):
    return (
        Grade.objects
        .select_related("attempt__exam")
        .annotate(attempt_retry=F("attempt__retry"))
        .filter(attempt__exam_id=id, attempt__active=True)
        .order_by("-created")
    )


class TutorExamGradePaperSchema(Schema):
    class TutorExamQuestionSchema(ExamQuestionSchema):
        solution: ExamSolutionSchema | None

    id: int
    earned_details: dict[str, int | None]
    answers: dict[str, str]
    feedback: dict[str, str]
    grader: OwnerSchema | None
    questions: list[TutorExamQuestionSchema]
    analysis: dict[str, dict[str, int]]
    confirmed: datetime | None

    @staticmethod
    def resolve_answers(grade: Grade):
        return {k: v for k, v in grade.attempt.submission.answers.items() if int(k) in grade.question_ids}

    @staticmethod
    def resolve_earned_details(grade: Grade):
        return {k: v for k, v in grade.earned_details.items() if int(k) in grade.question_ids}

    @staticmethod
    def resolve_feedback(grade: Grade):
        return {k: v for k, v in grade.feedback.items() if int(k) in grade.question_ids}

    @staticmethod
    def resolve_questions(grade: Grade):
        return grade.attempt.questions.all()


@router.get("/exam/{id}/grade/{grade_id}", response=TutorExamGradePaperSchema)
@allocation_required("exam", "exam")
async def get_exam_grade_paper(
    request: HttpRequest, id: str, grade_id: int, question_id: int | None = functions.Query(None, alias="questionId")
):
    if question_id:
        q = Q(id=question_id)
    else:
        q = Q(solution__correct_answers=[]) | Q(
            format__in=[Question.ExamQuestionFormatChoices.ESSAY, Question.ExamQuestionFormatChoices.TEXT_INPUT]
        )

    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__submission", "grader").prefetch_related(
            Prefetch(
                "attempt__questions",
                queryset=Question.objects
                .select_related("solution")
                .prefetch_related("attachments")
                .filter(q)
                .order_by("id"),
            )
        ),
        id=grade_id,
        attempt__exam_id=id,
        attempt__active=True,
    )
    grade.analysis = await Exam().analyze_answers([q.id for q in grade.attempt.questions.all()])
    grade.question_ids = [q.id for q in grade.attempt.questions.all()]

    return grade


@router.post("/exam/{id}/grade/{grade_id}", response=TutorGraeCompleteSchema)
@allocation_required("exam", "exam")
async def complete_exam_grade(request: HttpRequest, id: str, grade_id: int, data: TutorGradeSaveSchema):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__submission", "attempt__exam").prefetch_related(
            Prefetch("attempt__questions__solution")
        ),
        id=grade_id,
        attempt__exam_id=id,
        attempt__active=True,
    )
    grade.feedback.update(data.feedback)
    await grade.grade(data.earned_details, grader_id=request.auth)
    return grade


class TutorExamQuestionRegradeSchema(Schema):
    to_answers: Annotated[list[str], Field(min_length=1)]


@router.post("/exam/{id}/question/{question_id}/regrade")
@allocation_required("exam", "exam")
async def regrade_exam_question(request: HttpRequest, id: str, question_id: int, data: TutorExamQuestionRegradeSchema):
    regrade_exam_question_task.delay(exam_id=id, question_id=question_id, to_answers=data.to_answers)  # type: ignore
