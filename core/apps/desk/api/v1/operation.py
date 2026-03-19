from datetime import datetime

from django.db.models import Count, Exists, OuterRef, Q
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import OwnerSchema
from apps.common.schema import ContentTypeSchema, Schema, TimeStampedMixinSchema
from apps.common.util import HttpRequest, Pagination
from apps.operation.models import Announcement, Appeal, Inquiry, InquiryResponse

router = Router(by_alias=True)


class DeskAnnouncementSpec(TimeStampedMixinSchema):
    id: int
    title: str
    body: str
    public: bool
    pinned: bool
    read: int
    writer: OwnerSchema

    @staticmethod
    def resolve_body(obj: Announcement):
        return obj.cleaned_body


@router.get("/operation/announcement", response=list[DeskAnnouncementSpec])
@paginate(Pagination)
async def get_announcements(request: HttpRequest, search: str | None = None):
    announcements = (
        Announcement.objects
        .annotate(read=Count("reads"))
        .select_related("writer")
        .prefetch_related("attachments")
        .order_by("-pinned", "-created")
    )

    if search:
        announcements = announcements.filter(
            Q(title__icontains=search) | Q(body__icontains=search) | Q(writer__name__icontains=search)
        )

    return announcements


class DeskInquirySpec(TimeStampedMixinSchema):
    id: int
    title: str
    question: str
    writer: OwnerSchema
    content_type: ContentTypeSchema
    content_id: str
    solved: bool

    @staticmethod
    def resolve_question(inquiry: Inquiry):
        return inquiry.cleaned_question


@router.get("/operation/inquiry", response=list[DeskInquirySpec])
@paginate(Pagination)
async def get_inquiries(request: HttpRequest, search: str | None = None):
    inquiries = (
        Inquiry.objects
        .annotate(solved=Exists(InquiryResponse.objects.filter(inquiry=OuterRef("pk"), solved__isnull=False)))
        .select_related("writer", "content_type")
        .prefetch_related("attachments")
        .order_by("-created")
    )

    if search:
        inquiries = inquiries.filter(Q(writer__name__icontains=search) | Q(title__icontains=search))

    return inquiries


class DeskInquiryDetailSpec(Schema):
    class DeskInquiryResponseSpec(TimeStampedMixinSchema):
        id: int
        answer: str
        writer: OwnerSchema
        solved: datetime | None

    responses: list[DeskInquiryResponseSpec]


@router.get("/operation/inquiry/{id}", response=DeskInquiryDetailSpec)
async def get_inquiry_detail(request: HttpRequest, id: int):
    return {
        "responses": [
            r
            async for r in InquiryResponse.objects
            .select_related("writer")
            .filter(inquiry_id=id)
            .order_by("-created")[:10]
        ]
    }


class DeskAppealSpec(TimeStampedMixinSchema):
    id: int
    learner: OwnerSchema
    explanation: str
    review: str
    reviewer: OwnerSchema | None
    assessment_type: ContentTypeSchema
    assessment_id: int
    solved: bool

    @staticmethod
    def resolve_explanation(appeal: Appeal):
        return appeal.cleaned_explanation

    @staticmethod
    def resolve_solved(appeal: Appeal):
        return bool(appeal.review)


@router.get("/operation/appeal", response=list[DeskAppealSpec])
@paginate(Pagination)
async def get_appeals(request: HttpRequest, search: str | None = None):
    appeals = (
        Appeal.objects
        .select_related("learner", "reviewer", "assessment_type")
        .prefetch_related("attachments")
        .order_by("-created")
    )

    if search:
        appeals = appeals.filter(
            Q(learner__name__icontains=search) | Q(reviewer__name__icontains=search) | Q(explanation__icontains=search)
        )

    return appeals
