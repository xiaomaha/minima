from asgiref.sync import sync_to_async
from django.db.models import F
from django.shortcuts import aget_object_or_404
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import OwnerSchema
from apps.assignment.api.schema import AssignmentQuestionSchema, RubricSchema
from apps.assignment.documents import SubmissionDocument
from apps.assignment.models import Assignment, Grade
from apps.common.schema import Schema
from apps.common.util import HttpRequest, Pagination
from apps.tutor.api.v1.schema import TutorGradeSaveSchema, TutorGradeSchema, TutorGraeCompleteSchema
from apps.tutor.decorator import allocation_required, tutor_required

router = Router(by_alias=True)


class TutorAssignmentGradeSchema(TutorGradeSchema):
    @staticmethod
    def resolve_grading_date(grade: Grade):
        return grade.attempt.assignment.get_grading_date(access_date={"end": grade.attempt.lock})


@router.get("/assignment/{id}/grade", response=list[TutorAssignmentGradeSchema])
@tutor_required()
@allocation_required("assignment", "assignment")
@paginate(Pagination)
async def get_assignment_grades(request: HttpRequest, id: str):
    return (
        Grade.objects
        .select_related("attempt__assignment")
        .annotate(attempt_retry=F("attempt__retry"))
        .filter(attempt__assignment_id=id, attempt__active=True)
        .order_by("-created")
    )


class TutorAssignmentGradePaperSchema(Schema):
    id: int
    earned_details: dict[str, int | None]
    answer: str
    feedback: dict[str, str]
    grader: OwnerSchema | None
    question: AssignmentQuestionSchema
    analysis: dict[str, dict[str, int]]
    similar_answer: str | None

    @staticmethod
    def resolve_question(grade: Grade):
        return grade.attempt.question

    @staticmethod
    def resolve_answer(grade: Grade):
        return grade.attempt.submission.answer


@router.get("/assignment/{id}/grade/{grade_id}", response=TutorAssignmentGradePaperSchema)
@tutor_required()
@allocation_required("assignment", "assignment")
async def get_assignment_grade_paper(request: HttpRequest, id: str, grade_id: int):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__submission", "attempt__question", "grader").prefetch_related(
            "attempt__question__attachments"
        ),
        id=grade_id,
        attempt__assignment_id=id,
        attempt__active=True,
    )
    question_id = grade.attempt.question_id
    grade.analysis = await Assignment().analyze_answers([question_id])

    if grade.attempt.question.plagiarism_threshold > 0:
        test_result = await sync_to_async(SubmissionDocument.check_similarity)(
            question_id=question_id, user_id=grade.attempt.learner_id, text=grade.attempt.submission.answer
        )
        grade.similar_answer = test_result["similar_answer"]

    return grade


@router.get("assignment/{id}/rubric", response=RubricSchema)
@tutor_required()
@allocation_required("assignment", "assignment")
async def get_assignment_rubric(request: HttpRequest, id: str):
    assignment = await aget_object_or_404(
        Assignment.objects.prefetch_related("rubric__rubric_criteria__performance_levels"), id=id
    )
    return await assignment.get_rubric_data()


@router.post("/assignment/{id}/grade/{grade_id}", response=TutorGraeCompleteSchema)
@tutor_required()
@allocation_required("assignment", "assignment")
async def complete_assignment_grade(request: HttpRequest, id: str, grade_id: int, data: TutorGradeSaveSchema):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__submission", "attempt__question", "grader").prefetch_related(
            "attempt__assignment__rubric__rubric_criteria__performance_levels"
        ),
        id=grade_id,
        attempt__assignment_id=id,
        attempt__active=True,
    )
    grade.feedback.update(data.feedback)
    await grade.grade(data.earned_details, grader_id=request.auth)
    return grade
