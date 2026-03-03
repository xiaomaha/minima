from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import connection
from django.db.models import Value
from django.db.models.functions import JSONObject
from ninja import Router
from ninja.params import functions

from apps.assignment.models import Assignment
from apps.common.schema import ContentTypeSchema, Schema
from apps.common.util import HttpRequest, PaginatedResponse
from apps.competency.models import Certificate
from apps.content.models import Media
from apps.course.models import ASSESSIBLE_MODELS, Course
from apps.discussion.models import Discussion
from apps.exam.models import Exam
from apps.operation.models import FAQ, Category, FAQItem, Instructor
from apps.quiz.models import Quiz
from apps.studio.api.v1.assignment import router as assignment_router
from apps.studio.api.v1.course import router as course_router
from apps.studio.api.v1.discussion import router as discussion_router
from apps.studio.api.v1.exam import router as exam_router
from apps.studio.api.v1.media import router as media_router
from apps.studio.api.v1.quiz import router as quiz_router
from apps.studio.api.v1.survey import router as survey_router
from apps.studio.decorator import editor_required
from apps.studio.models import Draft
from apps.survey.models import Survey

router = Router(by_alias=True)


StudioModel = Literal["exam", "survey", "quiz", "assignment", "discussion", "media", "course"]


STUDIO_MODELS = {
    "exam": Exam,
    "survey": Survey,
    "quiz": Quiz,
    "assignment": Assignment,
    "discussion": Discussion,
    "media": Media,
    "course": Course,
}


class StudioContentTypeSpec(Schema):
    app_label: str
    model: StudioModel


class StudioContentSpec(Schema):
    id: str
    title: str
    thumbnail: str
    created: datetime
    modified: datetime
    edited: datetime | None
    published: datetime | None
    app_label: str
    model: StudioModel


@router.get("/content", response=PaginatedResponse[StudioContentSpec])
@editor_required()
async def content(
    request: HttpRequest,
    page: Annotated[int, functions.Query(1, ge=1)],
    size: Annotated[int, functions.Query(settings.DEFAULT_PAGINATION_SIZE, gte=1, le=100)],
    kind: Annotated[StudioModel, functions.Query(None)],
    search: str | None = None,
):
    table_names = [(M._meta.db_table, M._meta.app_label, M._meta.model_name) for M in STUDIO_MODELS.values()]
    if kind:
        table_names = [(t, a, m) for t, a, m in table_names if m == kind]

    draft_table = Draft._meta.db_table
    union_sql = " UNION ALL ".join(
        f"SELECT id, title, thumbnail, created, modified, published, '{app_label}' AS app_label, '{model_name}' AS model"
        + f" FROM {table} WHERE owner_id = %s"
        + (" AND title ILIKE %s" if search else "")
        for table, app_label, model_name in table_names
    )

    count_sql = f"""
        SELECT COUNT(*)
        FROM ({union_sql}) u
        LEFT OUTER JOIN {draft_table} d ON d.content_id = u.id AND d.author_id = %s
    """

    sql = f"""
        SELECT u.id, u.title, u.thumbnail, u.created, u.modified, u.published, u.app_label, u.model, d.edited
        FROM ({union_sql}) u
        LEFT OUTER JOIN {draft_table} d ON d.content_id = u.id AND d.author_id = %s
        ORDER BY COALESCE(d.edited, u.modified) DESC, u.modified DESC
        LIMIT %s OFFSET %s
    """

    author_id = request.auth
    offset = (page - 1) * size
    union_params = []

    for _ in table_names:
        union_params.append(author_id)
        if search:
            union_params.append(f"%{search}%")

    def execute():
        with connection.cursor() as cursor:
            cursor.execute(count_sql, [*union_params, author_id])
            total = cursor.fetchone()[0]
            cursor.execute(sql, [*union_params, author_id, size, offset])
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return total, rows

    total, rows = await sync_to_async(execute)()
    for item in rows:
        item["thumbnail"] = STUDIO_MODELS[item["model"]](thumbnail=item["thumbnail"]).thumbnail

    return {"items": rows, "count": total, "size": size, "page": page, "pages": ceil(total / size) if total else 1}


class ContentSuggestionSpec(Schema):
    id: str
    title: str


MAX_SUGGESTIONS = 1000


@router.get("/suggestion/content", response=list[ContentSuggestionSpec])
@editor_required()
async def content_suggestions(request: HttpRequest, kind: Annotated[StudioModel, functions.Query(...)]):
    return [
        raw
        async for raw in STUDIO_MODELS[kind]
        .objects.filter(owner_id=request.auth)
        .values("title", "id")
        .order_by("-modified")[:MAX_SUGGESTIONS]
    ]


class AssessmentSuggestion(Schema):
    id: str
    title: str
    item_type: ContentTypeSchema


@router.get("/suggestion/assessment", response=list[AssessmentSuggestion])
@editor_required()
async def assessment_suggestions(request: HttpRequest):
    qs = [
        M.objects
        .filter(owner_id=request.auth)
        .annotate(item_type=JSONObject(app_label=Value(M._meta.app_label), model=Value(M._meta.model_name)))
        .values("id", "title", "item_type")
        .order_by("-modified")[:MAX_SUGGESTIONS]
        for M in ASSESSIBLE_MODELS
    ]
    return [o async for o in qs[0].union(*qs[1:], all=True)]


class CertificateSuggestionSpec(Schema):
    id: int
    name: str


@router.get("/suggestion/certificate", response=list[CertificateSuggestionSpec])
@editor_required()
async def certificate_suggestions(request: HttpRequest):
    return [c async for c in Certificate.objects.filter(active=True).order_by("-modified")]


class CategorySuggestionSpec(Schema):
    id: int
    full_path: str


@router.get("/suggestion/category", response=list[CategorySuggestionSpec])
@editor_required()
async def category_suggestions(request: HttpRequest):
    return [
        {"id": c.id, "full_path": " / ".join([*c.ancestors, c.name])}
        async for c in Category.objects.filter(depth=3).order_by("id")
    ]


class InstructorSuggestionSpec(Schema):
    id: int
    name: str


@router.get("/suggestion/instructor", response=list[InstructorSuggestionSpec])
@editor_required()
async def instructor_suggestions(request: HttpRequest):
    return [c async for c in Instructor.objects.filter(active=True).order_by("-modified")]


class FAQSuggestionSpec(Schema):
    id: int
    name: str


@router.get("/suggestion/faq", response=list[FAQSuggestionSpec])
@editor_required()
async def faq_suggestions(request: HttpRequest):
    return [c async for c in FAQ.objects.order_by("-id")]


class FAQItemCopySpec(Schema):
    question: str
    answer: str
    active: bool


@router.get("/faq/{id}/item", response=list[FAQItemCopySpec])
@editor_required()
async def get_faq_items(request: HttpRequest, id: int):
    return [c async for c in FAQItem.objects.filter(faq_id=id, active=True).order_by("ordering")]


router.add_router("", exam_router, tags=["studio"])
router.add_router("", quiz_router, tags=["studio"])
router.add_router("", survey_router, tags=["studio"])
router.add_router("", discussion_router, tags=["studio"])
router.add_router("", assignment_router, tags=["studio"])
router.add_router("", media_router, tags=["studio"])
router.add_router("", course_router, tags=["studio"])
