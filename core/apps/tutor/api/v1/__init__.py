from datetime import datetime
from typing import Annotated, Literal

from django.conf import settings
from ninja import Router
from ninja.params import functions

from apps.common.schema import ContentTypeSchema, Schema
from apps.common.util import HttpRequest, PaginatedResponse
from apps.tutor.api.v1.exam import router as exam_router
from apps.tutor.decorator import tutor_required
from apps.tutor.models import Allocation

router = Router(by_alias=True)


TutoringModel = Literal["exam", "assignment", "discussion"]


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

    id: int
    content: TutorContentSchema
    content_type: ContentTypeSchema

    @staticmethod
    def resolve_content(allocation: Allocation):
        return allocation._content_cache


@router.get("/allocation", response=PaginatedResponse[AllocationSchema])
@tutor_required()
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
@tutor_required()
async def get_allocation_stats(request: HttpRequest):
    return await Allocation.get_stats(tutor_id=request.auth)


router.add_router("", exam_router, tags=["tutor"])
