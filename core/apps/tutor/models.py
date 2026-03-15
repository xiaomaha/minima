import asyncio
from collections import defaultdict
from typing import TYPE_CHECKING

import pghistory
import psycopg
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.db.models import CASCADE, BooleanField, CharField, Count, ForeignKey, Max, Model, Q, UniqueConstraint
from django.utils.translation import gettext_lazy as _

from apps.assignment.models import Assignment
from apps.assignment.models import Attempt as AssignmentAttempt
from apps.assignment.models import Grade as AssignmentGrade
from apps.common.error import ErrorCode
from apps.common.models import TimeStampedMixin
from apps.common.util import offset_paginate
from apps.discussion.models import Attempt as DiscussionAttempt
from apps.discussion.models import Discussion
from apps.discussion.models import Grade as DiscussionGrade
from apps.exam.models import Attempt as ExamAttempt
from apps.exam.models import Exam
from apps.exam.models import Grade as ExamGrade
from apps.operation.models import Appeal

User = get_user_model()


TUTORING_MODELS = {"exam": Exam, "assignment": Assignment, "discussion": Discussion}
TUTORING_MODEL_MAP = {(m._meta.app_label.lower(), m._meta.model_name): m for m in TUTORING_MODELS.values()}

ATTEMPT_MODELS = {"exam": ExamAttempt, "assignment": AssignmentAttempt, "discussion": DiscussionAttempt}
GRADING_MODELS = {"exam": ExamGrade, "assignment": AssignmentGrade, "discussion": DiscussionGrade}


@pghistory.track()
class Allocation(TimeStampedMixin):
    tutor = ForeignKey(User, CASCADE, verbose_name=_("Tutor"))
    active = BooleanField(_("Active"), default=True)

    limit_choices_to = {"model__in": list(TUTORING_MODELS.keys())}
    content_type = ForeignKey(ContentType, CASCADE, verbose_name=_("Content type"), limit_choices_to=limit_choices_to)
    content_id = CharField(_("Content ID"), max_length=36)
    content = GenericForeignKey("content_type", "content_id")

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Tutor Allocation")
        verbose_name_plural = _("Tutor Allocations")
        constraints = [
            UniqueConstraint(fields=["tutor", "content_type", "content_id"], name="tutor_allocation_coty_coid_uniq")
        ]

    if TYPE_CHECKING:
        pgh_event_model: type[Model]
        _content_cache: GenericForeignKey

    @classmethod
    async def get_allocated(cls, *, tutor_id: str, page: int, size: int):
        base_qs = cls.objects.select_related("content_type").filter(tutor_id=tutor_id).order_by("-modified")
        paginated = await offset_paginate(base_qs, page=page, size=size)

        if not paginated["items"]:
            return paginated

        content_ids = defaultdict(set)
        for allocation in paginated["items"]:
            content_ids[(allocation.content_type.app_label, allocation.content_type.model)].add(allocation.content_id)

        contents = await _fetch_allocatable_contents(content_ids)
        appeal_counts = await _fetch_appeal_counts(content_ids)

        valid_items = []
        for item in paginated["items"]:
            content = contents.get(item.content_id)
            if not content:
                continue
            content.update(appeal_counts.get(item.content_id, {"appeal_count": 0, "appeal_open_count": 0}))
            item._content_cache = content
            valid_items.append(item)

        paginated["items"] = valid_items

        return paginated

    @classmethod
    async def get_stats(cls, *, tutor_id: str) -> dict:
        content_ids_by_type: dict[tuple[str, str], set[str]] = defaultdict(set)
        allocation_count = 0
        async for allocation in cls.objects.select_related("content_type").filter(tutor_id=tutor_id):
            key = (allocation.content_type.app_label, allocation.content_type.model)
            content_ids_by_type[key].add(allocation.content_id)
            allocation_count += 1

        if allocation_count == 0:
            return {
                "allocation_count": 0,
                "submission_count": 0,
                "grade_completed_count": 0,
                "grade_confirmed_count": 0,
                "appeal_count": 0,
                "appeal_open_count": 0,
            }

        exam_ids = list(content_ids_by_type.get(("exam", "exam"), set()))
        assignment_ids = list(content_ids_by_type.get(("assignment", "assignment"), set()))
        discussion_ids = list(content_ids_by_type.get(("discussion", "discussion"), set()))

        grade_stats, appeal_stats = await asyncio.gather(
            _fetch_grade_stats(exam_ids, assignment_ids, discussion_ids),
            _fetch_appeal_stats(exam_ids, assignment_ids, discussion_ids),
        )

        return {"allocation_count": allocation_count, **grade_stats, **appeal_stats}

    @classmethod
    async def get_appeals(cls, *, tutor_id: str, app_label: str, model: str, content_id: str, page: int, size: int):
        content_type = await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, model)
        allocated = await cls.objects.filter(
            tutor_id=tutor_id, active=True, content_type=content_type, content_id=content_id
        ).aexists()
        if not allocated:
            raise ValueError(ErrorCode.PERMISSION_DENIED)

        question_type = await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, "question")

        if app_label == "exam":
            question_ids = ExamAttempt.objects.filter(exam_id=content_id).values("questions").distinct()
        elif app_label == "assignment":
            question_ids = AssignmentAttempt.objects.filter(assignment_id=content_id).values("question_id").distinct()
        elif app_label == "discussion":
            question_ids = DiscussionAttempt.objects.filter(discussion_id=content_id).values("question_id").distinct()
        else:
            raise ValueError(ErrorCode.UNKNOWN_CONTENT)

        qs = (
            Appeal.objects
            .filter(question_type=question_type, question_id__in=question_ids)
            .select_related("learner")
            .prefetch_related("attachments")
            .order_by("-created")
        )

        paginated = await offset_paginate(qs, page=page, size=size)
        if not paginated["items"]:
            return paginated

        items = paginated["items"]
        question_id_list = [a.question_id for a in items]
        learner_id_list = [a.learner_id for a in items]

        if app_label == "exam":
            grade_qs = (
                ExamGrade.objects
                .select_related("attempt")
                .prefetch_related("attempt__questions")
                .filter(
                    attempt__questions__id__in=question_id_list,
                    attempt__learner_id__in=learner_id_list,
                    attempt__active=True,
                )
            )
            grade_map = {(q.id, g.attempt.learner_id): g.id async for g in grade_qs for q in g.attempt.questions.all()}

        elif app_label == "assignment":
            grade_qs = AssignmentGrade.objects.select_related("attempt").filter(
                attempt__question_id__in=question_id_list, attempt__learner_id__in=learner_id_list, attempt__active=True
            )
            grade_map = {(g.attempt.question_id, g.attempt.learner_id): g.id async for g in grade_qs}

        elif app_label == "discussion":
            grade_qs = DiscussionGrade.objects.select_related("attempt").filter(
                attempt__question_id__in=question_id_list, attempt__learner_id__in=learner_id_list, attempt__active=True
            )
            grade_map = {(g.attempt.question_id, g.attempt.learner_id): g.id async for g in grade_qs}
        else:
            raise ValueError(ErrorCode.UNKNOWN_CONTENT)

        for appeal in items:
            appeal.grade_id = grade_map.get((appeal.question_id, appeal.learner_id))

        return paginated

    @classmethod
    async def review_appeal(cls, *, tutor_id: str, appeal_id: int, review: str, reviewer_id: str):
        appeal = await Appeal.objects.select_related("question_type").aget(id=appeal_id)

        app_label = appeal.question_type.app_label
        if app_label == "exam":
            content_id_qs = ExamAttempt.objects.filter(questions__id=appeal.question_id).values("exam_id")
        elif app_label == "assignment":
            content_id_qs = AssignmentAttempt.objects.filter(question_id=appeal.question_id).values("assignment_id")
        elif app_label == "discussion":
            content_id_qs = DiscussionAttempt.objects.filter(question_id=appeal.question_id).values("discussion_id")
        else:
            raise ValueError(ErrorCode.UNKNOWN_CONTENT)

        allocated = await Allocation.objects.filter(
            tutor_id=tutor_id, active=True, content_type__app_label=app_label, content_id__in=content_id_qs
        ).aexists()

        if not allocated:
            raise ValueError(ErrorCode.PERMISSION_DENIED)

        appeal.review = review
        appeal.reviewer_id = reviewer_id

        await appeal.asave(update_fields=["review"])


async def _fetch_allocatable_contents(content_ids_by_type: dict):
    union_qs = []

    for M in TUTORING_MODELS.values():
        key = (M._meta.app_label.lower(), M._meta.model_name)
        ids = content_ids_by_type.get(key)

        if not ids:
            continue

        union_qs.append(
            M.objects
            .filter(id__in=ids)
            .annotate(
                last_grading=Max("attempt__grade__completed"),
                submission_count=Count("attempt__grade", filter=Q(attempt__active=True), distinct=True),
                grade_completed_count=Count(
                    "attempt__grade",
                    filter=Q(attempt__active=True, attempt__grade__completed__isnull=False),
                    distinct=True,
                ),
                grade_confirmed_count=Count(
                    "attempt__grade",
                    filter=Q(attempt__active=True, attempt__grade__confirmed__isnull=False),
                    distinct=True,
                ),
            )
            .values(
                "id",
                "created",
                "modified",
                "title",
                "format",
                "last_grading",
                "submission_count",
                "grade_completed_count",
                "grade_confirmed_count",
            )
        )

    if not union_qs:
        return {}

    qs = union_qs[0] if len(union_qs) == 1 else union_qs[0].union(*union_qs[1:], all=True)
    return {content["id"]: content async for content in qs}


async def _fetch_appeal_counts(content_ids_by_type: dict[tuple[str, str], set[str]]) -> dict[str, dict]:
    exam_attempt_table = ExamAttempt._meta.db_table
    exam_m2m_table = ExamAttempt.questions.through._meta.db_table
    assignment_attempt_table = AssignmentAttempt._meta.db_table
    discussion_attempt_table = DiscussionAttempt._meta.db_table
    appeal_table = Appeal._meta.db_table

    ct_cache = {
        app_label: await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, "question")
        for app_label in ["exam", "assignment", "discussion"]
    }

    exam_ids = list(content_ids_by_type.get(("exam", "exam"), set()))
    assignment_ids = list(content_ids_by_type.get(("assignment", "assignment"), set()))
    discussion_ids = list(content_ids_by_type.get(("discussion", "discussion"), set()))

    sql = f"""
        SELECT DISTINCT ON (op.id) ea.exam_id AS content_id, op.review
        FROM {appeal_table} op
        JOIN {exam_m2m_table} aq ON aq.question_id = op.question_id
        JOIN {exam_attempt_table} ea ON ea.id = aq.attempt_id AND ea.active = TRUE
        WHERE op.question_type_id = %s AND ea.exam_id = ANY(%s)

        UNION ALL

        SELECT DISTINCT ON (op.id) ea.assignment_id AS content_id, op.review
        FROM {appeal_table} op
        JOIN {assignment_attempt_table} ea ON ea.question_id = op.question_id AND ea.active = TRUE
        WHERE op.question_type_id = %s AND ea.assignment_id = ANY(%s)

        UNION ALL

        SELECT DISTINCT ON (op.id) ea.discussion_id AS content_id, op.review
        FROM {appeal_table} op
        JOIN {discussion_attempt_table} ea ON ea.question_id = op.question_id AND ea.active = TRUE
        WHERE op.question_type_id = %s AND ea.discussion_id = ANY(%s)
    """

    params = connection.get_connection_params()
    params["cursor_factory"] = psycopg.AsyncCursor
    aconnection = await psycopg.AsyncConnection.connect(**params)

    result: dict[str, dict] = {}
    appeal_count: dict[str, int] = defaultdict(int)
    open_count: dict[str, int] = defaultdict(int)

    async with aconnection:
        async with aconnection.cursor() as cursor:
            await cursor.execute(  # type: ignore
                sql,
                [
                    ct_cache["exam"].pk,
                    exam_ids,
                    ct_cache["assignment"].pk,
                    assignment_ids,
                    ct_cache["discussion"].pk,
                    discussion_ids,
                ],
            )
            rows = await cursor.fetchall()

    for content_id, review in rows:
        appeal_count[content_id] += 1
        if not review:
            open_count[content_id] += 1

    for ids in content_ids_by_type.values():
        for cid in ids:
            result[cid] = {"appeal_count": appeal_count.get(cid, 0), "appeal_open_count": open_count.get(cid, 0)}

    return result


async def _fetch_grade_stats(exam_ids: list, assignment_ids: list, discussion_ids: list) -> dict:
    ea = ExamAttempt._meta.db_table
    eg = ExamGrade._meta.db_table
    aa = AssignmentAttempt._meta.db_table
    ag = AssignmentGrade._meta.db_table
    da = DiscussionAttempt._meta.db_table
    dg = DiscussionGrade._meta.db_table

    sql = f"""
        SELECT
            SUM(submission_count)      AS submission_count,
            SUM(grade_completed_count) AS grade_completed_count,
            SUM(grade_confirmed_count) AS grade_confirmed_count
        FROM (
            SELECT
                COUNT(DISTINCT g.id) FILTER (WHERE ea.active)                             AS submission_count,
                COUNT(DISTINCT g.id) FILTER (WHERE ea.active AND g.completed IS NOT NULL) AS grade_completed_count,
                COUNT(DISTINCT g.id) FILTER (WHERE ea.active AND g.confirmed IS NOT NULL) AS grade_confirmed_count
            FROM {eg} g
            JOIN {ea} ea ON ea.id = g.attempt_id
            WHERE ea.exam_id = ANY(%s)

            UNION ALL

            SELECT
                COUNT(DISTINCT g.id) FILTER (WHERE aa.active)                             AS submission_count,
                COUNT(DISTINCT g.id) FILTER (WHERE aa.active AND g.completed IS NOT NULL) AS grade_completed_count,
                COUNT(DISTINCT g.id) FILTER (WHERE aa.active AND g.confirmed IS NOT NULL) AS grade_confirmed_count
            FROM {ag} g
            JOIN {aa} aa ON aa.id = g.attempt_id
            WHERE aa.assignment_id = ANY(%s)

            UNION ALL

            SELECT
                COUNT(DISTINCT g.id) FILTER (WHERE da.active)                             AS submission_count,
                COUNT(DISTINCT g.id) FILTER (WHERE da.active AND g.completed IS NOT NULL) AS grade_completed_count,
                COUNT(DISTINCT g.id) FILTER (WHERE da.active AND g.confirmed IS NOT NULL) AS grade_confirmed_count
            FROM {dg} g
            JOIN {da} da ON da.id = g.attempt_id
            WHERE da.discussion_id = ANY(%s)
        ) combined
    """

    db_params = connection.get_connection_params()
    db_params["cursor_factory"] = psycopg.AsyncCursor
    aconnection = await psycopg.AsyncConnection.connect(**db_params)

    async with aconnection:
        async with aconnection.cursor() as cursor:
            await cursor.execute(sql, [exam_ids, assignment_ids, discussion_ids])  # type: ignore
            row = await cursor.fetchone()

        if not row:
            return {"submission_count": 0, "grade_completed_count": 0, "grade_confirmed_count": 0}

    return {"submission_count": row[0] or 0, "grade_completed_count": row[1] or 0, "grade_confirmed_count": row[2] or 0}


async def _fetch_appeal_stats(exam_ids: list, assignment_ids: list, discussion_ids: list) -> dict:
    exam_attempt_table = ExamAttempt._meta.db_table
    exam_m2m_table = ExamAttempt.questions.through._meta.db_table
    assignment_attempt_table = AssignmentAttempt._meta.db_table
    discussion_attempt_table = DiscussionAttempt._meta.db_table
    appeal_table = Appeal._meta.db_table

    ct_cache = {
        app_label: await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, "question")
        for app_label in ["exam", "assignment", "discussion"]
    }

    sql = f"""
        SELECT
            COUNT(*)                                     AS appeal_count,
            COUNT(*) FILTER (WHERE review = '')          AS appeal_open_count
        FROM (
            SELECT DISTINCT ON (op.id) op.review
            FROM {appeal_table} op
            JOIN {exam_m2m_table} aq ON aq.question_id = op.question_id
            JOIN {exam_attempt_table} ea ON ea.id = aq.attempt_id AND ea.active = TRUE
            WHERE op.question_type_id = %s AND ea.exam_id = ANY(%s)

            UNION ALL

            SELECT DISTINCT ON (op.id) op.review
            FROM {appeal_table} op
            JOIN {assignment_attempt_table} aa ON aa.question_id = op.question_id AND aa.active = TRUE
            WHERE op.question_type_id = %s AND aa.assignment_id = ANY(%s)

            UNION ALL

            SELECT DISTINCT ON (op.id) op.review
            FROM {appeal_table} op
            JOIN {discussion_attempt_table} da ON da.question_id = op.question_id AND da.active = TRUE
            WHERE op.question_type_id = %s AND da.discussion_id = ANY(%s)
        ) combined
    """

    db_params = connection.get_connection_params()
    db_params["cursor_factory"] = psycopg.AsyncCursor
    aconnection = await psycopg.AsyncConnection.connect(**db_params)

    async with aconnection:
        async with aconnection.cursor() as cursor:
            await cursor.execute(  # type: ignore
                sql,
                [
                    ct_cache["exam"].pk,
                    exam_ids,
                    ct_cache["assignment"].pk,
                    assignment_ids,
                    ct_cache["discussion"].pk,
                    discussion_ids,
                ],
            )
            row = await cursor.fetchone()

    if not row:
        return {"appeal_count": 0, "appeal_open_count": 0}

    return {"appeal_count": row[0] or 0, "appeal_open_count": row[1] or 0}
