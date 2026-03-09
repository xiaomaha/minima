from datetime import datetime
from typing import Annotated

from django.db.models import F, Prefetch, Q
from django.shortcuts import aget_object_or_404
from ninja import Field, Router
from ninja.pagination import paginate

from apps.account.api.schema import OwnerSchema
from apps.common.schema import Schema
from apps.common.util import GradingDate, HttpRequest, Pagination
from apps.exam.api.schema import ExamQuestionSchema, ExamSolutionSchema
from apps.exam.models import Exam, Grade, Question, Solution
from apps.operation.api.schema import AppealSchema
from apps.operation.models import Appeal
from apps.tutor.decorator import allocation_required, tutor_required
from apps.tutor.tasks import regrade_question

router = Router(by_alias=True)


class TutorExamGradeSchema(Schema):
    id: int
    created: datetime
    score: float
    passed: bool
    completed: datetime | None
    confirmed: datetime | None
    attempt_retry: int
    grading_date: GradingDate

    @staticmethod
    def resolve_grading_date(grade: Grade):
        return grade.attempt.exam.get_grading_date(access_date={"end": grade.attempt.lock})


@router.get("/exam/{id}/grade", response=list[TutorExamGradeSchema])
@tutor_required()
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

    @staticmethod
    def resolve_answers(grade: Grade):
        question_ids = [q.id for q in grade.attempt.questions.all()]
        return {k: v for k, v in grade.attempt.submission.answers.items() if int(k) in question_ids}

    @staticmethod
    def resolve_earned_details(grade: Grade):
        question_ids = [q.id for q in grade.attempt.questions.all()]
        return {k: v for k, v in grade.earned_details.items() if int(k) in question_ids}

    @staticmethod
    def resolve_questions(grade: Grade):
        return grade.attempt.questions.all()


@router.get("/exam/{id}/grade/{grade_id}", response=TutorExamGradePaperSchema)
@tutor_required()
@allocation_required("exam", "exam")
async def get_exam_grade_paper(request: HttpRequest, id: str, grade_id: int):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__submission", "grader").prefetch_related(
            Prefetch(
                "attempt__questions",
                queryset=Question.objects
                .select_related("solution")
                .prefetch_related("attachments")
                .filter(
                    Q(solution__correct_answers=[])
                    | Q(
                        format__in=[
                            Question.ExamQuestionFormatChoices.ESSAY,
                            Question.ExamQuestionFormatChoices.TEXT_INPUT,
                        ]
                    )
                )
                .order_by("id"),
            )
        ),
        id=grade_id,
        attempt__exam_id=id,
        attempt__active=True,
    )
    grade.analysis = await Exam().analyze_answers([q.id for q in grade.attempt.questions.all()])

    return grade


class TutorExamGradeSaveSchema(Schema):
    earned_details: dict[str, int | None]
    feedback: dict[str, str]


class TutorExamGradeSavedSchema(Schema):
    score: float
    passed: bool
    completed: datetime | None


@router.post("/exam/{id}/grade/{grade_id}", response=TutorExamGradeSavedSchema)
@tutor_required()
@allocation_required("exam", "exam")
async def complete_exam_grade(request: HttpRequest, id: str, grade_id: int, data: TutorExamGradeSaveSchema):
    grade = await aget_object_or_404(
        Grade.objects
        .annotate(attempt_retry=F("attempt__retry"))
        .select_related("attempt__submission", "attempt__exam")
        .prefetch_related(
            Prefetch(
                "attempt__questions",
                queryset=Question.objects.select_related("solution").prefetch_related("attachments"),
            )
        ),
        id=grade_id,
        attempt__exam_id=id,
        attempt__active=True,
    )
    grade.feedback.update(data.feedback)
    await grade.grade(data.earned_details, grader_id=request.auth)
    return grade


@router.get("/exam/{id}/appeal", response=list[AppealSchema])
@tutor_required()
@allocation_required("exam", "exam")
@paginate(Pagination)
async def get_exam_appeals(request: HttpRequest, id: str):
    question_ids = Question.objects.filter(pool__exam__id=id).values("id")
    return Appeal.objects.prefetch_related("attachments").filter(
        question_type__app_label="exam", question_type__model="question", question_id__in=question_ids
    )


class TutorExamAppealSaveSchema(Schema):
    review: Annotated[str, Field(min_length=1)]
    appeal_ids: list[int]


@router.post("/exam/{id}/appeal")
@tutor_required()
@allocation_required("exam", "exam")
async def review_exam_appeals(request: HttpRequest, id: str, data: TutorExamAppealSaveSchema):
    question_ids = Question.objects.filter(pool__exam__id=id).values("id")
    await Appeal.objects.filter(
        id__in=data.appeal_ids,
        question_type__app_label="exam",
        question_type__model="question",
        question_id__in=question_ids,
    ).aupdate(review=data.review)


class TutorExamQuestionSolutionSchema(Schema):
    correct_answers: list[str]
    correct_criteria: str
    explanation: str


@router.post("/exam/{id}/question/{question_id}/solution")
@tutor_required()
@allocation_required("exam", "exam")
async def update_exam_question_solution(
    request: HttpRequest, id: str, question_id: int, data: TutorExamQuestionSolutionSchema
):
    solution = await aget_object_or_404(Solution.objects.filter(question__pool__exam__id=id, question_id=question_id))

    original_answers = set(solution.correct_answers)
    for key, value in data.dict().items():
        setattr(solution, key, value)
    await solution.asave()

    if original_answers != set(data.correct_answers):
        regrade_question.delay(
            exam_id=id, question_id=question_id, from_answers=list(original_answers), to_answers=data.correct_answers
        )
