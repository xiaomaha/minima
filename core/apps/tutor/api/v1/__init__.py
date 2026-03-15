from datetime import datetime
from typing import Annotated, Literal

from django.conf import settings
from ninja import Field, Router
from ninja.params import functions

from apps.common.schema import Schema
from apps.common.util import HttpRequest, PaginatedResponse
from apps.operation.api.schema import AppealSchema
from apps.tutor.api.v1.assignment import router as assignment_router
from apps.tutor.api.v1.discussion import router as discussion_router
from apps.tutor.api.v1.exam import router as exam_router
from apps.tutor.models import Allocation

router = Router(by_alias=True)


class AllocationSchema(Schema):
    class TutorContentSchema(Schema):
        id: str
        created: datetime
        title: str
        last_grading: datetime | None
        submission_count: int
        grade_completed_count: int
        grade_confirmed_count: int
        appeal_count: int
        appeal_open_count: int

    class TutorContentTypeSchema(Schema):
        app_label: Literal["exam", "assignment", "discussion"]
        model: Literal["exam", "assignment", "discussion"]

    id: int
    content: TutorContentSchema
    content_type: TutorContentTypeSchema

    @staticmethod
    def resolve_content(allocation: Allocation):
        return allocation._content_cache


@router.get("/allocation", response=PaginatedResponse[AllocationSchema])
async def get_allocation(
    request: HttpRequest,
    page: Annotated[int, functions.Query(1, ge=1)],
    size: Annotated[int, functions.Query(settings.DEFAULT_PAGINATION_SIZE, gte=1, le=100)],
):
    return await Allocation.get_allocated(tutor_id=request.auth, page=page, size=size)


class AllocationStatsSchema(Schema):
    allocation_count: int
    submission_count: int
    grade_completed_count: int
    grade_confirmed_count: int
    appeal_count: int
    appeal_open_count: int


@router.get("/allocation/stats", response=AllocationStatsSchema)
async def get_allocation_stats(request: HttpRequest):
    return await Allocation.get_stats(tutor_id=request.auth)


AppealAppLabel = Literal["exam", "assignment", "discussion"]
AppealModel = Literal["exam", "assignment", "discussion"]


class GradeAppealSchema(AppealSchema):
    grade_id: int


@router.get("/{app_label}/{model}/{id}/appeal", response=PaginatedResponse[GradeAppealSchema])
async def get_appeals(
    request: HttpRequest,
    app_label: AppealAppLabel,
    model: AppealModel,
    id: str,
    page: Annotated[int, functions.Query(1, ge=1)],
    size: Annotated[int, functions.Query(settings.DEFAULT_PAGINATION_SIZE, gte=1, le=100)],
):
    return await Allocation.get_appeals(
        tutor_id=request.auth, app_label=app_label, model=model, content_id=id, page=page, size=size
    )


class AppealReviewSchema(Schema):
    review: Annotated[str, Field(min_length=1)]


@router.post("/appeal/{id}")
async def review_appeal(request: HttpRequest, id: int, review: AppealReviewSchema):
    await Allocation.review_appeal(tutor_id=request.auth, appeal_id=id, review=review.review, reviewer_id=request.auth)


router.add_router("", exam_router, tags=["tutor"])
router.add_router("", assignment_router, tags=["tutor"])
router.add_router("", discussion_router, tags=["tutor"])
