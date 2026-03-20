import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, cast

import pghistory
from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.aggregates.general import ArrayAgg
from django.db import IntegrityError, connection
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    Case,
    CharField,
    Count,
    DateTimeField,
    Exists,
    F,
    ForeignKey,
    ImageField,
    Index,
    JSONField,
    Model,
    OuterRef,
    PositiveIntegerField,
    Q,
    QuerySet,
    Subquery,
    TextField,
    UniqueConstraint,
    Value,
    When,
)
from django.db.models.functions import Concat, JSONObject
from django.db.models.functions.math import Round
from django.forms import ValidationError
from django.utils import timezone
from django.utils.translation import gettext as t
from django.utils.translation import gettext_lazy as _

from apps.assignment.models import Assignment
from apps.assignment.models import Attempt as AssignmentAttempt
from apps.assignment.models import Grade as AssignmentGrade
from apps.common.error import ErrorCode
from apps.common.models import LearningObjectMixin, OrderableMixin, TimeStampedMixin
from apps.common.util import normalize_context, offset_paginate
from apps.content.models import Media, Watch
from apps.course.models import Course, Engagement, Gradebook
from apps.discussion.models import Attempt as DiscussionAttempt
from apps.discussion.models import Discussion
from apps.discussion.models import Grade as DiscussionGrade
from apps.exam.models import Attempt as ExamAttempt
from apps.exam.models import Exam
from apps.exam.models import Grade as ExamGrade
from apps.learning.trigger import content_exists_trigger
from apps.operation.models import MessageType, user_message_created
from apps.partner.models import Cohort
from apps.quiz.models import Attempt as QuziAttempt
from apps.quiz.models import Grade as QuizGrade
from apps.quiz.models import Quiz
from apps.survey.models import Submission as SurveySubmission
from apps.survey.models import Survey

log = logging.getLogger(__name__)

User = get_user_model()

ENROLLABLE_MODELS = [Course, Media, Exam, Assignment, Discussion, Quiz, Survey]
ENROLLABLE_MODEL_MAP = {(m._meta.app_label.lower(), m._meta.model_name): m for m in ENROLLABLE_MODELS}

# cf Course.ASSESSIBLE_GRADE_MODELS
ALL_GRADE_MODELS = {Exam: ExamGrade, Assignment: AssignmentGrade, Discussion: DiscussionGrade, Quiz: QuizGrade}


@pghistory.track()
class Enrollment(TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    active = BooleanField(_("Active"), default=True)
    start = DateTimeField(_("Start"), default=timezone.now)
    end = DateTimeField(_("End"))
    archive = DateTimeField(_("Archive"))
    enrolled = DateTimeField(_("Enrolled"), auto_now_add=True)
    content_type = ForeignKey(
        ContentType,
        CASCADE,
        verbose_name=_("Content Type"),
        limit_choices_to={"model__in": [m._meta.model_name for m in ENROLLABLE_MODELS]},
    )
    content_id = CharField(_("Content ID"), max_length=36)
    content = GenericForeignKey("content_type", "content_id")
    enrolled_by = ForeignKey(User, on_delete=SET_NULL, verbose_name=_("Enrolled By"), null=True, related_name="+")
    label = CharField(_("Label"), max_length=255)
    term = ForeignKey("LearningTerm", on_delete=SET_NULL, verbose_name=_("Term"), null=True)

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Enrollment")
        verbose_name_plural = _("Enrollments")
        indexes = [
            Index(fields=["user", "content_id", "active"]),
            Index(fields=["enrolled"]),
            Index(fields=["content_id"]),
            Index(fields=["label"]),
        ]
        constraints = [
            UniqueConstraint(
                fields=["user", "content_type", "content_id"],
                condition=Q(active=True),
                name="enrollment_enrollment_us_itty_itid_uniq",
            )
        ]

    if TYPE_CHECKING:
        content_type_id: int
        pgh_event_model: type[Model]
        _content_cache: GenericForeignKey
        enrolled_by_id: str
        user_id: str

    @property
    def can_deactivate(self):
        return self.active and self.enrolled_by_id == self.user_id

    def clean(self):
        if self.content_type_id and self.content_id:
            model_class = self.content_type.model_class()
            if not model_class or not model_class.objects.filter(id=self.content_id).exists():
                raise ValidationError(_("Content does not exist"))

    @classmethod
    async def deactivate(cls, *, id: int, user_id: str):
        enrollment = await cls.objects.aget(id=id, user_id=user_id, active=True)
        if not enrollment.can_deactivate:
            raise ValueError(ErrorCode.PERMISSION_DENIED)
        enrollment.active = False
        await enrollment.asave()

    @classmethod
    async def get_enrollments(cls, *, user_id: str, page: int, size: int):
        now = timezone.now()
        base_qs = (
            cls.objects
            .select_related("content_type", "term")
            .filter(user_id=user_id, active=True, archive__gte=now)
            .order_by("-enrolled")
        )
        paginated = await offset_paginate(base_qs, page=page, size=size)

        if not paginated["items"]:
            return paginated

        content_ids = defaultdict(set)
        for enrollment in paginated["items"]:
            content_ids[(enrollment.content_type.app_label, enrollment.content_type.model)].add(enrollment.content_id)

        contents = await _fetch_enrollable_contents(content_ids)
        paginated["items"] = await _attach_contents(paginated["items"], contents)

        return paginated

    @classmethod
    async def get_records(cls, user_id: str):
        # Asserted content_id is actually unique

        # to exclude inactive course engagements
        # this makes contect_key unique in course engagement
        active_course_keys = Engagement.objects.filter(learner_id=user_id, active=True).values_list(
            Concat(Value("course::"), F("course_id"), Value("::"), F("pk"), output_field=CharField())
        )

        qs = (
            # media
            Watch.objects
            .filter(
                Q(~Q(context__startswith="course::")) | Q(context__in=Subquery(active_course_keys)), user_id=user_id
            )
            .annotate(rate_=Round("rate", 2))
            .values_list("media_id", "context", "rate_")
        )

        for M, G in ALL_GRADE_MODELS.items():
            pk_path = f"attempt__{M._meta.model_name}_id"
            qs = qs.union(
                G.objects
                .annotate(score_=Round("score", 2))
                .filter(
                    Q(~Q(attempt__context__startswith="course::"))
                    | Q(attempt__context__in=Subquery(active_course_keys)),
                    attempt__learner_id=user_id,
                    attempt__active=True,
                    completed__isnull=False,
                )
                .values_list(pk_path, "attempt__context", "score_"),
                all=True,
            )

        # add survey records
        qs = qs.union(
            SurveySubmission.objects.filter(respondent_id=user_id, active=True).values_list(
                "survey_id", "context", Value(100)
            )
        )

        # content_id, context, rate or score
        records: dict[str, dict[str, float]] = {}
        async for record in qs:
            content_id, context, value = record

            if context.startswith("course"):
                context = normalize_context(context)

            # another context ...
            if content_id not in records:
                records[content_id] = {}
            records[content_id][context] = value

        enrollments = [
            e
            async for e in Enrollment.objects
            .filter(user_id=user_id, active=True)
            .values("content_type__app_label", "content_type__model")
            .annotate(content_ids=ArrayAgg("content_id"))
        ]

        course_ids: list[str] = []

        for enrollment in enrollments:
            app_label = enrollment["content_type__app_label"]
            model = enrollment["content_type__model"]
            M = ENROLLABLE_MODEL_MAP.get((app_label, model), None)

            if M == Course:
                course_ids.extend(enrollment["content_ids"])

        if course_ids:
            # course have rate and score
            course_grades = [
                g
                async for g in Gradebook.objects.filter(
                    engagement__course_id__in=course_ids, engagement__learner_id=user_id, engagement__active=True
                ).values_list("engagement__course_id", "score")
            ]

            for course_id, score in course_grades:
                if course_id not in records:
                    records[course_id] = {}
                records[course_id][""] = score

        return records

    @classmethod
    def get_report(cls, user_id: str, start: date | None, end: date | None):
        params: dict = {"user_id": user_id}

        date_conditions = []
        if start:
            params["start"] = timezone.make_aware(datetime.combine(start, time.min))
            date_conditions.append("%(start)s")
        if end:
            params["end"] = timezone.make_aware(datetime.combine(end, time.max))
            date_conditions.append("%(end)s")

        def date_filter(field: str):
            if not date_conditions:
                return ""
            if len(date_conditions) == 2:
                return f"AND {field} BETWEEN %(start)s AND %(end)s"
            if start:
                return f"AND {field} >= %(start)s"
            return f"AND {field} <= %(end)s"

        query = f"""
            SELECT
                (SELECT COUNT(*) FROM {cls._meta.db_table}
                 WHERE user_id = %(user_id)s AND active = true {date_filter("enrolled")})
                    AS enrollment_count,

                (SELECT COUNT(*) FROM {ExamAttempt._meta.db_table}
                 WHERE learner_id = %(user_id)s AND active = true {date_filter("started")})
                    AS exam_attempt_count,

                (SELECT COUNT(*) FROM {DiscussionAttempt._meta.db_table}
                 WHERE learner_id = %(user_id)s AND active = true {date_filter("started")})
                    AS discussion_attempt_count,

                (SELECT COUNT(*) FROM {AssignmentAttempt._meta.db_table}
                 WHERE learner_id = %(user_id)s AND active = true {date_filter("started")})
                    AS assignment_attempt_count,

                (SELECT COUNT(*) FROM {QuziAttempt._meta.db_table}
                 WHERE learner_id = %(user_id)s AND active = true {date_filter("started")})
                    AS quiz_attempt_count,

                (SELECT COUNT(*) FROM {SurveySubmission._meta.db_table}
                 WHERE respondent_id = %(user_id)s AND active = true {date_filter("started")})
                    AS survey_submission_count,

                (SELECT COUNT(*) FROM {Watch._meta.db_table}
                 WHERE user_id = %(user_id)s {date_filter("created")})
                    AS watch_media_count,

                (SELECT COALESCE(SUM(BIT_COUNT(watch_bits)), 0) FROM {Watch._meta.db_table}
                 WHERE user_id = %(user_id)s {date_filter("created")})
                    AS watch_seconds
        """

        with connection.cursor() as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
            columns = [col[0] for col in cursor.description]

        return dict(zip(columns, row))

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)

        if is_new and self.user_id != self.enrolled_by_id:
            content = cast(LearningObjectMixin, self.content)
            user_message_created.send(
                source=self,
                message=MessageType(
                    user_id=self.user_id, title=t("%s Enrollment") % self.content_type.model, body=content.title
                ),
            )


setattr(Enrollment._meta, "triggers", [content_exists_trigger(Enrollment._meta.db_table, ContentType._meta.db_table)])


@pghistory.track()
class LearningTerm(TimeStampedMixin):
    name = CharField(_("Name"), max_length=255, unique=True)
    user_count = PositiveIntegerField(_("User Count"), default=0)
    enrollment_count = PositiveIntegerField(_("Enrollment Count"), default=0)
    breakdown = JSONField(_("Breakdown"), default=dict)

    class Meta:
        verbose_name = _("Learning Term")
        verbose_name_plural = _("Learning Terms")

    async def sync(self):
        await sync_to_async(self._sync)()

    def _sync(self):
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE {self._meta.db_table} SET
                    enrollment_count = (
                        SELECT COUNT(*) FROM {Enrollment._meta.db_table}
                        WHERE term_id = %(term_id)s AND active = true
                    ),
                    user_count = (
                        SELECT COUNT(DISTINCT user_id) FROM {Enrollment._meta.db_table}
                        WHERE term_id = %(term_id)s AND active = true
                    ),
                    breakdown = (
                        SELECT COALESCE(jsonb_object_agg(model, cnt), '{{}}')
                        FROM (
                            SELECT ct.model, COUNT(*) as cnt
                            FROM {Enrollment._meta.db_table} e
                            JOIN {ContentType._meta.db_table} ct ON ct.id = e.content_type_id
                            WHERE e.term_id = %(term_id)s AND e.active = true
                            GROUP BY ct.model
                        ) s
                    )
                WHERE id = %(term_id)s
                """,
                {"term_id": self.id},
            )


@pghistory.track()
class Catalog(TimeStampedMixin):
    name = CharField(_("Name"), max_length=255, unique=True)
    description = TextField(_("Description"), blank=True, default="")
    thumbnail = ImageField(_("Thumbnail"), null=True, blank=True)
    active = BooleanField(_("Active"), default=True)
    public = BooleanField(_("Public"), default=False)
    available_from = DateTimeField(_("Available From"), default=timezone.now)
    available_until = DateTimeField(_("Available Until"))
    breakdown = JSONField(_("Breakdown"), default=dict)

    class Meta:
        verbose_name = _("Catalog")
        verbose_name_plural = _("Catalogs")

    if TYPE_CHECKING:
        item_content_type_id: int
        catalog_items: QuerySet[CatalogItem]

    def is_available(self):
        if not self.active:
            return False

        now = timezone.now()
        return self.available_from <= now <= self.available_until

    @classmethod
    def get_catalogs(cls, user_id: str):
        now = timezone.now()

        user_cohort_name = CohortCatalog.objects.filter(
            catalog=OuterRef("pk"), cohort__cohort_members__member__user_id=user_id
        ).values("cohort__name")[:1]

        return (
            cls.objects
            .filter(
                Q(available_from__lte=now, available_until__gte=now, active=True)
                & (
                    Q(public=True)
                    | Q(user_catalogs__user_id=user_id)
                    | Q(cohort_catalogs__cohort__cohort_members__member__user_id=user_id)
                )
            )
            .annotate(item_count=Count("catalog_items", distinct=True), cohort_name=Subquery(user_cohort_name))
            .annotate(
                provider=Case(
                    When(public=True, then=Value("public")),
                    When(cohort_name__isnull=True, then=Value("personal")),
                    default=Value("cohort"),
                    output_field=CharField(),
                )
            )
            .distinct()
            .order_by("-id")
        )

    @classmethod
    async def get_items(cls, *, catalog_id: int, user_id: str, page: int, size: int):
        base_qs = (
            CatalogItem.objects
            .select_related("content_type")
            .annotate(
                enrolled=Exists(
                    Enrollment.objects.filter(
                        user_id=user_id,
                        active=True,
                        content_id=OuterRef("content_id"),
                        content_type=OuterRef("content_type"),
                    )
                )
            )
            .filter(catalog_id=catalog_id, catalog__active=True)
            .order_by("ordering", "-id")
        )
        paginated = await offset_paginate(base_qs, page=page, size=size)

        if not paginated["items"]:
            return paginated

        content_ids = defaultdict(set)
        for item in paginated["items"]:
            content_ids[(item.content_type.app_label, item.content_type.model)].add(item.content_id)

        contents = await _fetch_enrollable_contents(content_ids)
        paginated["items"] = await _attach_contents(paginated["items"], contents)

        return paginated

    @classmethod
    async def enroll_catalog_item(
        cls, *, catalog_id: int, user_id: str, content_id: str, app_label: str, model: str, enrolled_by_id: str
    ):
        now = timezone.now()
        catalog = (
            await Catalog.objects
            .filter(id=catalog_id, available_from__lte=now, available_until__gte=now, active=True)
            .filter(
                Q(public=True)
                | Q(user_catalogs__user_id=user_id)
                | Q(cohort_catalogs__cohort__cohort_members__member__user_id=user_id)
            )
            .filter(
                catalog_items__content_id=content_id,
                catalog_items__content_type__app_label=app_label,
                catalog_items__content_type__model=model,
            )
            .annotate(
                item_content_type_id=Subquery(
                    ContentType.objects.filter(app_label=app_label, model=model).values("id")[:1]
                )
            )
            .afirst()
        )

        if not catalog:
            raise ValueError(ErrorCode.ACCESS_DENIED)

        M = ENROLLABLE_MODEL_MAP[(app_label, model)]
        item = await M.objects.aget(id=content_id)

        term, _ = await LearningTerm.objects.aget_or_create(name=catalog.name)

        try:
            enrollment = await Enrollment.objects.acreate(
                user_id=user_id,
                active=True,
                start=now,
                end=catalog.available_until,
                archive=catalog.available_until + timedelta(days=settings.DEFAULT_REVIEW_PERIOD_DAYS),
                enrolled=now,
                content_type_id=catalog.item_content_type_id,
                content_id=content_id,
                enrolled_by_id=enrolled_by_id,
                label=item.title,
                term_id=term.id,
            )
        except IntegrityError as e:
            log.error(e, exc_info=True)
            raise ValueError(ErrorCode.ALREADY_EXISTS)

        await term.sync()

        return enrollment

    async def sync(self):
        await sync_to_async(self._sync)()

    def _sync(self):
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE {self._meta.db_table} SET
                    breakdown = (
                        SELECT COALESCE(jsonb_object_agg(model, cnt), '{{}}')
                        FROM (
                            SELECT ct.model, COUNT(*) as cnt
                            FROM {CatalogItem._meta.db_table} item
                            JOIN {ContentType._meta.db_table} ct ON ct.id = item.content_type_id
                            WHERE item.catalog_id = %(catalog_id)s
                            GROUP BY ct.model
                        ) s
                    )
                WHERE id = %(catalog_id)s
                """,
                {"catalog_id": self.id},
            )


class CatalogItem(TimeStampedMixin, OrderableMixin):
    catalog = ForeignKey(Catalog, CASCADE, related_name="catalog_items", verbose_name=_("Catalog"))
    content_type = ForeignKey(
        ContentType,
        CASCADE,
        verbose_name=_("Content Type"),
        limit_choices_to={"model__in": [m._meta.model_name for m in ENROLLABLE_MODELS]},
    )
    content_id = CharField(_("Content ID"), max_length=36)
    content = GenericForeignKey("content_type", "content_id")
    label = CharField(_("Label"), max_length=255)

    ordering_group = ("catalog",)

    class Meta:
        verbose_name = _("Catalog Item")
        verbose_name_plural = _("Catalog Items")
        constraints = [
            UniqueConstraint(
                fields=["catalog", "content_type", "content_id"], name="learning_catalogitem_ca_itty_itid_uniq"
            )
        ]

    if TYPE_CHECKING:
        _content_cache: GenericForeignKey


setattr(CatalogItem._meta, "triggers", [content_exists_trigger(CatalogItem._meta.db_table, ContentType._meta.db_table)])


@pghistory.track()
class UserCatalog(TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    catalog = ForeignKey(Catalog, CASCADE, related_name="user_catalogs", verbose_name=_("Catalog"))
    granted_by = ForeignKey(User, CASCADE, verbose_name=_("Granted By"), null=True, related_name="+")
    note = TextField(_("Note"), blank=True, default="")

    class Meta:
        verbose_name = _("User Catalog")
        verbose_name_plural = _("User Catalogs")
        constraints = [UniqueConstraint(fields=["user", "catalog"], name="learning_usercatalog_us_ca_uniq")]

    if TYPE_CHECKING:
        user_id: str
        granted_by_id: str

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)

        if is_new and self.user_id != self.granted_by_id:
            user_message_created.send(
                source=self.catalog,
                message=MessageType(user_id=self.user_id, title=t("User Catalog Enrollment"), body=self.catalog.name),
            )


@pghistory.track()
class CohortCatalog(TimeStampedMixin):
    cohort = ForeignKey(Cohort, CASCADE, verbose_name=_("Cohort"))
    catalog = ForeignKey(Catalog, CASCADE, related_name="cohort_catalogs", verbose_name=_("Catalog"))
    granted_by = ForeignKey(User, CASCADE, verbose_name=_("Granted By"), null=True, related_name="+")
    note = TextField(_("Note"), blank=True, default="")

    class Meta:
        verbose_name = _("Cohort Catalog")
        verbose_name_plural = _("Cohort Catalogs")
        constraints = [UniqueConstraint(fields=["cohort", "catalog"], name="learning_cohortcatalog_co_ca_uniq")]


async def _fetch_enrollable_contents(content_ids_by_type: dict):
    union_qs = []

    for M in ENROLLABLE_MODELS:
        key = (M._meta.app_label.lower(), M._meta.model_name)
        ids = content_ids_by_type.get(key)

        if not ids:
            continue

        union_qs.append(
            M.objects
            .filter(id__in=ids)
            .annotate(
                owner_obj=JSONObject(
                    id=F("owner__id"),
                    name=F("owner__name"),
                    email=F("owner__email"),
                    avatar=F("owner__avatar"),
                    nickname=F("owner__nickname"),
                )
            )
            .values(
                "id",
                "created",
                "modified",
                "title",
                "description",
                "audience",
                "thumbnail",
                "featured",
                "format",
                "duration",
                "passing_point",
                "max_attempts",
                "verification_required",
                "owner_obj",
            )
        )

    if not union_qs:
        return {}

    qs = union_qs[0] if len(union_qs) == 1 else union_qs[0].union(*union_qs[1:], all=True)
    return {content["id"]: content async for content in qs}


async def _attach_contents(items, contents):
    valid_items = []
    for item in items:
        origin_content = contents.get(item.content_id)
        if not origin_content:
            continue

        M = ENROLLABLE_MODEL_MAP.get((item.content_type.app_label, item.content_type.model))
        if not M:
            continue

        content_data = origin_content.copy()
        user = User(**content_data.pop("owner_obj"))
        item._content_cache = M(**content_data, owner=user)
        valid_items.append(item)

    return valid_items
