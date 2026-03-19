from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import connection
from django.db.models import F, Value
from django.db.models.functions import JSONObject
from ninja import Router
from ninja.params import functions

from apps.assignment.models import Assignment
from apps.common.error import ErrorCode
from apps.common.schema import ContentTypeSchema, Schema
from apps.common.util import HttpRequest, PaginatedResponse
from apps.competency.models import Certificate
from apps.content.models import Media
from apps.course.models import ASSESSIBLE_MODELS, Course
from apps.discussion.models import Discussion
from apps.exam.models import Exam
from apps.operation.models import FAQ, Category, HonorCode, Instructor
from apps.quiz.models import Quiz
from apps.studio.api.v1.assignment import router as assignment_router
from apps.studio.api.v1.course import router as course_router
from apps.studio.api.v1.discussion import router as discussion_router
from apps.studio.api.v1.exam import router as exam_router
from apps.studio.api.v1.media import router as media_router
from apps.studio.api.v1.quiz import router as quiz_router
from apps.studio.api.v1.survey import router as survey_router
from apps.studio.models import Editing
from apps.survey.models import Survey


def studio_auth(request: HttpRequest):
    return request.auth if "studio" in request.roles else ""


router = Router(by_alias=True, auth=studio_auth)


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

    editing_table = Editing._meta.db_table
    union_sql = " UNION ALL ".join(
        f"SELECT id, title, thumbnail, created, modified, published, '{app_label}' AS app_label, '{model_name}' AS model"
        + f" FROM {table} WHERE owner_id = %s"
        + (" AND title ILIKE %s" if search else "")
        for table, app_label, model_name in table_names
    )

    count_sql = f"""
        SELECT COUNT(*)
        FROM ({union_sql}) u
        LEFT OUTER JOIN {editing_table} d ON d.content_id = u.id AND d.author_id = %s
    """

    sql = f"""
        SELECT u.id, u.title, u.thumbnail, u.created, u.modified, u.published, u.app_label, u.model, d.edited
        FROM ({union_sql}) u
        LEFT OUTER JOIN {editing_table} d ON d.content_id = u.id AND d.author_id = %s
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


MAX_SUGGESTIONS = 1000


class AssessmentSuggestionSpec(Schema):
    id: str
    label: str
    item_type: ContentTypeSchema


@router.get("/suggestion/assessment", response=list[AssessmentSuggestionSpec])
async def assessment_suggestions(request: HttpRequest):
    qs = [
        M.objects
        .filter(owner_id=request.auth)  # required owner permission
        .annotate(item_type=JSONObject(app_label=Value(M._meta.app_label), model=Value(M._meta.model_name)))
        .annotate(label=F("title"))
        .values("id", "label", "item_type")
        .order_by("label")[:MAX_SUGGESTIONS]
        for M in ASSESSIBLE_MODELS
    ]
    return [o async for o in qs[0].union(*qs[1:], all=True)]


class ContentSuggestionSpec(Schema):
    id: str
    label: str


@router.get("/suggestion/content", response=list[ContentSuggestionSpec])
async def content_suggestions(request: HttpRequest, kind: Annotated[StudioModel, functions.Query(...)]):
    return [
        raw
        async for raw in STUDIO_MODELS[kind]
        .objects.annotate(label=F("title"))
        .filter(owner_id=request.auth)  # required owner permission
        .values("label", "id")
        .order_by("label")[:MAX_SUGGESTIONS]
    ]


class InlineSuggestionSpec(Schema):
    id: int
    label: str


InlineItem = Literal["honor_code", "faq", "category", "instructor", "certificate"]


@router.get("/suggestion/inline", response=list[InlineSuggestionSpec])
async def inline_suggestions(request: HttpRequest, kind: Annotated[InlineItem, functions.Query(...)]):
    qs = None

    if kind == "honor_code":
        qs = HonorCode.objects.annotate(label=F("title"))

    elif kind == "faq":
        qs = FAQ.objects.annotate(label=F("name"))

    elif kind == "instructor":
        qs = Instructor.objects.filter(active=True).annotate(label=F("name"))

    elif kind == "certificate":
        qs = Certificate.objects.filter(active=True).annotate(label=F("name"))

    elif kind == "category":
        return [
            {"id": c.id, "label": " / ".join([*c.ancestors, c.name])}
            async for c in Category.objects.filter(depth=3).order_by("id")
        ][:MAX_SUGGESTIONS]

    if qs is None:
        raise ValueError(ErrorCode.UNKNOWN_CONTENT)

    return [item async for item in qs.values("id", "label").order_by("label")][:MAX_SUGGESTIONS]


router.add_router("", exam_router, tags=["studio"])
router.add_router("", quiz_router, tags=["studio"])
router.add_router("", survey_router, tags=["studio"])
router.add_router("", discussion_router, tags=["studio"])
router.add_router("", assignment_router, tags=["studio"])
router.add_router("", media_router, tags=["studio"])
router.add_router("", course_router, tags=["studio"])
