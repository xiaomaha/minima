from datetime import datetime

from django.db.models import Q
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import OwnerSchema
from apps.common.schema import ContentTypeSchema, PGHContextSchema, Schema, TimeStampedMixinSchema
from apps.common.util import HttpRequest, Pagination
from apps.learning.models import Catalog, CatalogItem, Enrollment, LearningTerm

router = Router(by_alias=True)


class DeskEnrollmentSpec(TimeStampedMixinSchema):
    id: int
    user: OwnerSchema
    active: bool
    start: datetime
    end: datetime
    archive: datetime
    enrolled: datetime
    content_type: ContentTypeSchema
    content_id: str
    enrolled_by: OwnerSchema | None
    label: str
    term: str | None

    @staticmethod
    def resolve_term(enrollment: Enrollment):
        return enrollment.term.name if enrollment.term else None


@router.get("/learning/enrollment", response=list[DeskEnrollmentSpec])
@paginate(Pagination)
async def get_enrollments(request: HttpRequest, search: str | None = None):
    enrollments = Enrollment.objects.select_related("user", "content_type", "enrolled_by", "term").order_by("-created")

    if search:
        enrollments = enrollments.filter(
            Q(user__name__icontains=search)
            | Q(content_id__icontains=search)
            | Q(label__icontains=search)
            | Q(term__name__icontains=search)
        )

    return enrollments


class DeskEnrollmentDetailSpec(Schema):
    class DeskEnrollmentDetailHistorySpec(Schema):
        pgh_created_at: datetime
        pgh_context: PGHContextSchema | None
        id: int
        active: bool
        start: datetime
        end: datetime
        archive: datetime

    histories: list[DeskEnrollmentDetailHistorySpec]


@router.get("/learning/enrollment/{id}", response=DeskEnrollmentDetailSpec)
async def get_enrollment_detail(request: HttpRequest, id: int):
    return {
        "histories": [
            h
            async for h in Enrollment.pgh_event_model.objects
            .select_related("pgh_context")
            .filter(Q(pgh_obj_id=id) & ~Q(pgh_label="insert"))
            .order_by("-pgh_created_at")[:10]
        ]
    }


class DeskBreakDownSpec(Schema):
    # enrollable model name
    course: int | None = None
    media: int | None = None
    exam: int | None = None
    assignment: int | None = None
    discussion: int | None = None
    quiz: int | None = None
    survey: int | None = None


class DeskLearningTermSpec(TimeStampedMixinSchema):
    id: int
    name: str
    user_count: int
    enrollment_count: int
    breakdown: DeskBreakDownSpec


@router.get("/learning/term", response=list[DeskLearningTermSpec])
@paginate(Pagination)
async def get_terms(request: HttpRequest, search: str | None = None):
    terms = LearningTerm.objects.order_by("-created")

    if search:
        terms = terms.filter(name__icontains=search)

    return terms


class DeskCatalogSpec(TimeStampedMixinSchema):
    id: int
    name: str
    description: str
    thumbnail: str
    active: bool
    public: bool
    available_from: datetime
    available_until: datetime
    item_count: int
    breakdown: DeskBreakDownSpec

    @staticmethod
    def resolve_item_count(obj: Catalog):
        return sum(obj.breakdown.values())


@router.get("/learning/catalog", response=list[DeskCatalogSpec])
@paginate(Pagination)
async def get_catalogs(request: HttpRequest, search: str | None = None):
    catalogs = Catalog.objects.order_by("-created")

    if search:
        catalogs = catalogs.filter(name__icontains=search)

    return catalogs


class DeskCatalogDetailSpec(Schema):
    class DeskCatalogItemSpec(TimeStampedMixinSchema):
        id: int
        created: datetime
        modified: datetime
        content_type: ContentTypeSchema
        label: str
        ordering: int

    items: list[DeskCatalogItemSpec]


@router.get("/learning/catalog/{id}", response=DeskCatalogDetailSpec)
async def get_catalog_detail(request: HttpRequest, id: int):
    return {
        "items": [
            item
            async for item in CatalogItem.objects
            .select_related("content_type")
            .filter(catalog_id=id)
            .order_by("ordering")
        ]
    }
