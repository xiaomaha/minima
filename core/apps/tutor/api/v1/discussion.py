from django.db.models import F, Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import OwnerSchema
from apps.common.schema import Schema
from apps.common.util import HttpRequest, Pagination
from apps.discussion.api.schema import (
    DiscussionEarnedDetailsSchema,
    DiscussionFeedbackSchema,
    DiscussionOwnPostSchema,
    DiscussionQuestionSchema,
)
from apps.discussion.models import Grade, Post
from apps.tutor.api.v1.schema import TutorGradeSchema, TutorGraeCompleteSchema
from apps.tutor.decorator import allocation_required, tutor_required

router = Router(by_alias=True)


class TutorDiscussionGradeSchema(TutorGradeSchema):
    @staticmethod
    def resolve_grading_date(grade: Grade):
        return grade.attempt.discussion.get_grading_date(access_date={"end": grade.attempt.lock})


@router.get("/discussion/{id}/grade", response=list[TutorDiscussionGradeSchema])
@tutor_required()
@allocation_required("discussion", "discussion")
@paginate(Pagination)
async def get_discussion_grades(request: HttpRequest, id: str):
    return (
        Grade.objects
        .select_related("attempt__discussion")
        .annotate(attempt_retry=F("attempt__retry"))
        .filter(attempt__discussion_id=id, attempt__active=True)
        .order_by("-created")
    )


class TutorDiscussionGradePaperSchema(Schema):
    id: int
    earned_details: DiscussionEarnedDetailsSchema
    feedback: DiscussionFeedbackSchema
    grader: OwnerSchema | None
    question: DiscussionQuestionSchema
    posts: list[DiscussionOwnPostSchema]

    @staticmethod
    def resolve_question(grade: Grade):
        return grade.attempt.question

    @staticmethod
    def resolve_posts(grade: Grade):
        return grade.attempt.posts


@router.get("/discussion/{id}/grade/{grade_id}", response=TutorDiscussionGradePaperSchema)
@tutor_required()
@allocation_required("discussion", "discussion")
async def get_discussion_grade_paper(request: HttpRequest, id: str, grade_id: int):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__question", "grader").prefetch_related(
            "attempt__question__attachments",
            Prefetch("attempt__posts", queryset=Post.objects.prefetch_related("attachments").order_by("id")),
        ),
        id=grade_id,
        attempt__discussion_id=id,
        attempt__active=True,
    )

    return grade


class TutorDiscussionGradeSaveSchema(Schema):
    class DiscussionEarnedDetailsSaveSchema(Schema):
        tutor_assessment: int

    class DiscussionFeedbackSaveSchema(Schema):
        tutor_assessment: str

    earned_details: DiscussionEarnedDetailsSaveSchema
    feedback: DiscussionFeedbackSaveSchema


@router.post("/discussion/{id}/grade/{grade_id}", response=TutorGraeCompleteSchema)
@tutor_required()
@allocation_required("discussion", "discussion")
async def complete_discussion_grade(request: HttpRequest, id: str, grade_id: int, data: TutorDiscussionGradeSaveSchema):
    grade = await aget_object_or_404(
        Grade.objects.select_related("attempt__question", "attempt__discussion", "grader"),
        id=grade_id,
        attempt__discussion_id=id,
        attempt__active=True,
    )
    grade.feedback.update(data.feedback.model_dump())
    await grade.grade(data.earned_details.model_dump(), grader_id=request.auth)
    return grade
