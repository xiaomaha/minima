from collections import defaultdict
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from itertools import chain
from typing import TYPE_CHECKING, NotRequired, TypedDict

import pghistory
from asgiref.sync import sync_to_async
from celery.exceptions import ImproperlyConfigured
from django.apps import apps
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.core.signing import dumps
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    CharField,
    Count,
    F,
    FloatField,
    ForeignKey,
    Index,
    JSONField,
    ManyToManyField,
    Model,
    OneToOneField,
    PositiveSmallIntegerField,
    Q,
    QuerySet,
    TextChoices,
    TextField,
    UniqueConstraint,
    URLField,
)
from django.db.models.query import Prefetch
from django.db.utils import IntegrityError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.account.models import OtpLog
from apps.assignment.models import Assignment
from apps.assignment.models import Grade as AssignmentGrade
from apps.common.error import ErrorCode
from apps.common.models import BooleanNowField, LearningObjectMixin, OrderableMixin, TimeStampedMixin
from apps.common.util import AccessDate, OtpTokenDict, issue_active_context
from apps.competency.models import Certificate, CertificateAward, CertificateAwardDataDict
from apps.content.models import Media
from apps.course.trigger import course_create_grading_policy, lessonmedia_unifier
from apps.discussion.models import Discussion
from apps.discussion.models import Grade as DiscussionGrade
from apps.exam.models import Exam
from apps.exam.models import Grade as ExamGrade
from apps.operation.models import FAQ, Category, FAQItem, HonorCode, Instructor
from apps.survey.models import Survey

User = get_user_model()

if TYPE_CHECKING:
    from apps.account.models import User


ASSESSIBLE_MODELS = [Exam, Assignment, Discussion]
ASSESSIBLE_MODEL_MAP = {(M._meta.app_label, M._meta.model.__name__.lower()): M for M in ASSESSIBLE_MODELS}
ASSESSIBLE_GRADE_MODELS = {Exam: ExamGrade, Assignment: AssignmentGrade, Discussion: DiscussionGrade}

TEMPLATE_SCHEDULES = {
    "start_today_email": {"offset_days": 0, "time": "09:00"},
    "weekly_progress_email": {"cron": "0 10 * * 1"},
    "exam_today_email": {"offset_days": 14, "time": "09:00"},
    "end_today_email": {"offset_days": 30, "time": "18:00"},
    "grade_completed_email": {"offset_days": 1, "time": "10:00"},
    "certificate_issued_email": {"offset_days": 0, "time": "15:00"},
}


class SessionDict(TypedDict):
    access_date: AccessDate
    course: Course
    engagement: NotRequired[Engagement]
    otp_token: NotRequired[str]
    certificate_awards: NotRequired[list[CertificateAward]]
    # stats: NotRequired["ScoreStatsDict"]


@pghistory.track()
class MessagePreset(Model):
    title = CharField(_("Title"), max_length=255, unique=True)
    description = TextField(_("Description"), blank=True, default="")
    templates = ArrayField(CharField(max_length=50), verbose_name=_("Templates"), blank=True, default=list)

    class Meta:
        verbose_name = _("Message Preset")
        verbose_name_plural = _("Message Presets")

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.templates:
            self.templates = list(dict.fromkeys(self.templates))
        super().save(*args, **kwargs)


@pghistory.track()
class Course(LearningObjectMixin):
    class LevelChoices(TextChoices):
        BEGINNER = "beginner", _("Beginner")
        INTERMEDIATE = "intermediate", _("Intermediate")
        ADVANCED = "advanced", _("Advanced")
        COMMON = "common", _("Common")

    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    objective = TextField(_("Objective"), blank=True, default="")
    preview_url = URLField(_("Preview URL"), blank=True, null=True)
    effort_hours = PositiveSmallIntegerField(_("Effort Hours"))
    level = CharField(_("Level"), max_length=20, choices=LevelChoices.choices)
    faq = ForeignKey(FAQ, SET_NULL, null=True, blank=True, verbose_name=_("FAQ"))
    honor_code = ForeignKey(HonorCode, CASCADE, verbose_name=_("Honor Code"))
    message_preset = ForeignKey(MessagePreset, SET_NULL, null=True, blank=True, verbose_name=_("Message Preset"))

    instructors = ManyToManyField(Instructor, through="CourseInstructor", blank=True, verbose_name=_("Instructors"))
    surveys = ManyToManyField(Survey, through="CourseSurvey", blank=True, verbose_name=_("Surveys"))

    categories = ManyToManyField(Category, blank=True, verbose_name=_("Categories"))
    related_courses = ManyToManyField("self", blank=True, symmetrical=False, verbose_name=_("Related Courses"))
    certificates = ManyToManyField(Certificate, blank=True, verbose_name=_("Certificates"))

    class Meta(LearningObjectMixin.Meta):
        verbose_name = _("Course")
        verbose_name_plural = _("Courses")
        constraints = [UniqueConstraint(fields=["owner", "title"], name="course_course_ow_ti_uniq")]

    if TYPE_CHECKING:
        lesson_set: "QuerySet[Lesson]"
        assessment_set: "QuerySet[Assessment]"
        gradingpolicy: "GradingPolicy"
        grading_criteria: list[GradingCriterionDict]
        pk: str
        coursesurvey_set: "QuerySet[CourseSurvey]"

    def __str__(self):
        return f"{self.title} ({self.pk})"

    @classmethod
    async def get_session(cls, *, course_id: str, learner_id: str, access_date: AccessDate):
        course = (
            await cls.objects
            .select_related("owner", "gradingpolicy", "honor_code")
            .prefetch_related(  # type: ignore
                Prefetch(
                    "lesson_set",
                    queryset=Lesson.objects.order_by("start_offset").prefetch_related(
                        Prefetch(
                            "medias",
                            queryset=Media.objects.annotate(ordering=F("lessonmedia__ordering")).order_by(
                                "lessonmedia__ordering"
                            ),
                        )
                    ),
                ),
                Prefetch(
                    "coursesurvey_set",
                    queryset=CourseSurvey.objects.annotate(title=F("survey__title")).order_by("start_offset"),
                ),
            )
            .aget(id=course_id)
        )
        course.grading_criteria = await course.gradingpolicy.grading_criteria(access_date)
        session = SessionDict(access_date=access_date, course=course)

        for unit in chain(course.lesson_set.all(), course.coursesurvey_set.all()):
            unit.start_date = access_date["start"] + timedelta(days=unit.start_offset)
            unit.end_date = (
                unit.start_date + timedelta(days=unit.end_offset) if unit.end_offset is not None else access_date["end"]
            )

        engagement = (
            await Engagement.objects
            .select_related("gradebook")
            .filter(course=course, learner_id=learner_id, active=True)
            .afirst()
        )
        if not engagement:
            if course.verification_required:
                session["otp_token"] = dumps(
                    OtpTokenDict(consumer_id=course.pk, app_label="course", model="course", user_id=learner_id)
                )
            return session

        session["engagement"] = engagement

        if hasattr(engagement, "gradebook") and engagement.gradebook.certificate_eligible:
            session["certificate_awards"] = [
                c
                async for c in CertificateAward.objects
                .filter(
                    recipient_id=learner_id,
                    content_type=await sync_to_async(ContentType.objects.get_for_model)(engagement),
                    content_id=engagement.pk,
                    revoked__isnull=True,
                )
                .exclude(expires__lte=timezone.now())
                .order_by("id")
            ]

        return session

    @classmethod
    async def get_detail(cls, id: str):
        return (
            await cls.objects
            .select_related("owner")
            .prefetch_related(  # type: ignore
                Prefetch("faq__faqitem_set", FAQItem.objects.filter(active=True).order_by("ordering")),
                Prefetch("categories", Category.objects.order_by("id")),
                Prefetch(
                    "certificates",
                    Certificate.objects.select_related("issuer").filter(active=True).order_by("-created"),
                ),
                Prefetch(
                    "instructors",
                    Instructor.objects
                    .annotate(lead=F("courseinstructor__lead"))
                    .filter(active=True)
                    .order_by("courseinstructor__ordering"),
                ),
                Prefetch("related_courses", Course.objects.order_by("-modified")),
            )
            .aget(id=id)
        )

    @classmethod
    async def content_effective_date(
        cls, *, course_id: str, content_id: str, app_label: str, model: str, access_date: AccessDate
    ):
        if ASSESSIBLE_MODEL_MAP.get((app_label, model)):
            accessible = await Assessment.objects.aget(
                course_id=course_id, item_id=content_id, item_type__app_label=app_label, item_type__model=model
            )
        elif app_label == Media._meta.app_label and model == Media._meta.model.__name__.lower():
            # unique by lessonmedia trigger
            accessible = await Lesson.objects.aget(course_id=course_id, lessonmedia__media_id=content_id)
        elif app_label == Survey._meta.app_label and model == Survey._meta.model.__name__.lower():
            accessible = await CourseSurvey.objects.aget(course_id=course_id, survey_id=content_id)
        else:
            raise ValueError(ErrorCode.UNKNOWN_COURSE_CONTENT)

        start = access_date["start"] + timedelta(days=accessible.start_offset)
        end = start + timedelta(days=accessible.end_offset) if accessible.end_offset is not None else access_date["end"]
        return AccessDate(start=start, end=end, archive=access_date["archive"])

    @classmethod
    async def issue_context(cls, *, course_id: str, user_id: str):
        en = await Engagement.objects.only("pk", "course_id").aget(course_id=course_id, learner_id=user_id, active=True)
        return en.issue_context()


@pghistory.track()
class CourseInstructor(OrderableMixin):
    course = ForeignKey(Course, CASCADE, verbose_name=_("Course"))
    instructor = ForeignKey(Instructor, CASCADE, verbose_name=_("Instructor"))
    lead = BooleanField(_("Lead"), default=False)

    ordering_group = ("course",)

    class Meta(OrderableMixin.Meta):
        verbose_name = _("Course Instructor")
        verbose_name_plural = _("Course Instructors")
        constraints = [UniqueConstraint(fields=["course", "instructor"], name="course_courseinstructor_co_in_uniq")]


@pghistory.track()
class CourseSurvey(Model):
    course = ForeignKey(Course, CASCADE, verbose_name=_("Course"))
    survey = ForeignKey(Survey, CASCADE, verbose_name=_("Survey"))
    start_offset = PositiveSmallIntegerField(_("Start Offset (Days)"))
    end_offset = PositiveSmallIntegerField(_("End Offset (Days) from Start Offset"), null=True, blank=True)

    class Meta:
        verbose_name = _("Course Survey")
        verbose_name_plural = _("Course Surveys")
        constraints = [UniqueConstraint(fields=["course", "survey"], name="course_coursesurvey_co_su_uniq")]

    if TYPE_CHECKING:
        start_date: datetime
        end_date: datetime


@pghistory.track()
class Lesson(Model):
    course = ForeignKey(Course, CASCADE, verbose_name=_("Course"))
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), blank=True, default="")
    medias = ManyToManyField(Media, through="LessonMedia", verbose_name=_("Medias"))
    start_offset = PositiveSmallIntegerField(_("Start Offset (Days)"))
    end_offset = PositiveSmallIntegerField(_("End Offset (Days) from Start Offset"), null=True, blank=True)

    class Meta:
        verbose_name = _("Lesson")
        verbose_name_plural = _("Lessons")
        constraints = [UniqueConstraint(fields=["course", "title"], name="course_lesson_co_ti_uniq")]

    if TYPE_CHECKING:
        start_date: datetime
        end_date: datetime

    def __str__(self):
        return self.title


@pghistory.track()
class LessonMedia(OrderableMixin):
    lesson = ForeignKey(Lesson, CASCADE, verbose_name=_("Lesson"))
    media = ForeignKey(Media, CASCADE, verbose_name=_("Media"))

    ordering_group = ("lesson",)

    class Meta(OrderableMixin.Meta):
        verbose_name = _("Lesson Media")
        verbose_name_plural = _("Lesson Medias")
        constraints = [UniqueConstraint(fields=["lesson", "media"], name="course_lessonmedia_le_me_uniq")]

    if TYPE_CHECKING:
        media_id = str()


setattr(LessonMedia._meta, "triggers", [lessonmedia_unifier(LessonMedia._meta.db_table, Lesson._meta.db_table)])


@pghistory.track()
class Assessment(Model):
    course = ForeignKey(Course, CASCADE, verbose_name=_("Course"))
    weight = PositiveSmallIntegerField(_("Weight"))
    start_offset = PositiveSmallIntegerField(_("Start Offset (Days)"))
    end_offset = PositiveSmallIntegerField(_("End Offset (Days) from Start Offset"), null=True, blank=True)
    item_type = ForeignKey(
        ContentType,
        CASCADE,
        verbose_name=_("Item Type"),
        limit_choices_to={"model__in": [m.__name__.lower() for m in ASSESSIBLE_MODELS]},
    )
    item_id = CharField(_("Item ID"), max_length=36)
    item = GenericForeignKey("item_type", "item_id")

    class Meta:
        verbose_name = _("Assessment")
        verbose_name_plural = _("Assessments")
        indexes = [Index(fields=["item_type", "item_id"])]
        constraints = [
            UniqueConstraint(fields=["course", "item_type", "item_id"], name="course_assessment_co_itty_itid_uniq")
        ]


class GradingCriterionDict(TypedDict):
    title: str
    app_label: str
    model: str
    weight: int
    passing_point: int
    normalized_weight: float
    item_id: str
    start_date: datetime | None
    end_date: datetime | None


@pghistory.track()
class GradingPolicy(Model):
    course = OneToOneField(Course, CASCADE, verbose_name=_("Course"))
    assessment_weight = PositiveSmallIntegerField(_("Assessment Weight"), default=100)
    completion_weight = PositiveSmallIntegerField(_("Completion Weight"), default=0)
    completion_passing_point = PositiveSmallIntegerField(_("Completion Passing Point"), default=80)

    class Meta:
        verbose_name = _("Grading Policy")
        verbose_name_plural = _("Grading Policies")

    if TYPE_CHECKING:
        course_id: str

    async def grading_criteria(self, access_date: AccessDate | None = None) -> list[GradingCriterionDict]:
        start_date = access_date["start"] if access_date else None
        end_date = access_date["end"] if access_date else None
        criteria: list[GradingCriterionDict] = []

        total_weight = self.completion_weight + self.assessment_weight

        if self.completion_weight or self.completion_passing_point:
            criteria.append(
                GradingCriterionDict(
                    title="Completion",
                    app_label="",
                    model="completion",
                    weight=self.completion_weight,
                    passing_point=self.completion_passing_point,
                    normalized_weight=float(self.completion_weight * 100 / total_weight) if total_weight else 0.0,
                    item_id=self.course_id,
                    start_date=start_date,
                    end_date=end_date,
                )
            )

        assessments = [
            assessment
            async for assessment in self.course.assessment_set.select_related("item_type").order_by(
                "start_offset", "end_offset"
            )
        ]

        if not assessments:
            return criteria

        type_to_ids: dict[tuple[str, str], list[str]] = {}

        for assessment in assessments:
            key = (assessment.item_type.app_label, assessment.item_type.model)
            type_to_ids.setdefault(key, []).append(assessment.item_id)

        qs_list = []
        for (app_label, model_name), ids in type_to_ids.items():
            model_class = apps.get_model(app_label, model_name)
            qs = model_class.objects.filter(id__in=ids).values("id", "title", "passing_point")
            qs_list.append(qs)

        items_qs = qs_list[0].union(*qs_list[1:]) if len(qs_list) > 1 else qs_list[0]
        items = [item async for item in items_qs.all()]

        if not items:
            return criteria

        items_dict = {item["id"]: item for item in items}

        for assessment in assessments:
            item = items_dict.get(assessment.item_id)
            if not item:
                continue

            if not assessment.weight and not item["passing_point"]:
                continue

            start_offset = assessment.start_offset
            end_offset = assessment.end_offset

            criteria.append(
                GradingCriterionDict(
                    title=item["title"],
                    app_label=assessment.item_type.app_label,
                    model=assessment.item_type.model,
                    weight=assessment.weight,
                    passing_point=item["passing_point"],
                    normalized_weight=0.0,
                    item_id=assessment.item_id,
                    start_date=start_date + timedelta(days=start_offset) if start_date else None,
                    end_date=None
                    if not start_date
                    else (start_date + timedelta(days=start_offset + end_offset) if end_offset else end_date),
                )
            )

        if not criteria or all(p["weight"] == 0 for p in criteria):
            return criteria

        if len(criteria) == 1:
            criteria[0]["normalized_weight"] = 100.0
            return criteria

        assessment_criteria = [p for p in criteria if p["model"] != "completion"]
        if not assessment_criteria:
            return criteria

        total_assessment_weight = sum(p["weight"] for p in assessment_criteria)
        if total_assessment_weight == 0:
            return criteria

        assessment_ratio = Decimal(str(self.assessment_weight)) / total_weight * 100
        normalized_weights: list[tuple[int, Decimal]] = []

        for i, policy in enumerate(assessment_criteria):
            normalized_weight = Decimal(str(policy["weight"])) / total_assessment_weight * assessment_ratio
            normalized_weight = normalized_weight.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
            normalized_weights.append((i, normalized_weight))
            policy["normalized_weight"] = float(normalized_weight)

        total_normalized = sum(weight for _, weight in normalized_weights)
        difference = assessment_ratio - total_normalized

        if difference != 0:
            max_idx, _ = max(normalized_weights, key=lambda x: x[1])
            assessment_criteria[max_idx]["normalized_weight"] += float(difference)

        return criteria


setattr(Course._meta, "triggers", [course_create_grading_policy(Course._meta.db_table, GradingPolicy._meta.db_table)])


@pghistory.track()
class Engagement(TimeStampedMixin):
    course = ForeignKey(Course, CASCADE, verbose_name=_("Course"))
    learner = ForeignKey(User, CASCADE, verbose_name=_("Learner"))
    last_lesson = ForeignKey(Lesson, SET_NULL, verbose_name=_("Last Lesson"), null=True, blank=True)
    active = BooleanField(_("Active"), default=True)

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Engagement")
        verbose_name_plural = _("Engagements")
        indexes = [Index(fields=["learner_id", "active"])]
        constraints = [
            UniqueConstraint(
                fields=["course", "learner"], condition=Q(active=True), name="course_engagement_co_le_uniq"
            )
        ]

    if TYPE_CHECKING:
        certificate_ids: list[int]  # annotated
        course_id: str
        learner_id: str

    def issue_context(self):
        return issue_active_context("course", self.course_id, self.pk)

    @classmethod
    async def start(cls, *, course_id: str, learner_id: str):
        course = await Course.objects.aget(id=course_id)

        if course.verification_required:
            if not await OtpLog.check_otp_verification(user_id=learner_id, consumer=course):
                raise ValueError(ErrorCode.OTP_VERIFICATION_REQUIRED)

        try:
            engagement = await Engagement.objects.acreate(course_id=course_id, learner_id=learner_id, active=True)
        except IntegrityError:
            raise ValueError(ErrorCode.ALREADY_EXISTS)

        engagement._state.fields_cache["gradebook"] = None  # type: ignore

        return engagement

    @classmethod
    async def request_certificate(cls, *, course_id: str, user_id: str, certificate_id: int, verification_url: str):
        engagement = (
            await cls.objects
            .select_related("course", "learner", "gradebook")
            .annotate(
                certificate_ids=ArrayAgg(
                    "course__certificates__pk", filter=Q(course__certificates__active=True), distinct=True
                )
            )
            .aget(course_id=course_id, learner_id=user_id, active=True)
        )

        if certificate_id not in engagement.certificate_ids:
            raise ValueError(ErrorCode.CERTIFICATE_NOT_IN_COURSE)

        gradebook = getattr(engagement, "gradebook", None)
        if not (gradebook and gradebook.certificate_eligible):
            raise ValueError(ErrorCode.NOT_QUALIFIED_FOR_CERTIFICATE)

        data = CertificateAwardDataDict(
            document_title=str(_("Course Completion Certificate")),
            completion_title=engagement.course.title,
            completion_period=f"{engagement.created.strftime('%Y-%m-%d')} ~ {gradebook.confirmed.strftime('%Y-%m-%d')}",
            completion_hours=_("%(hours)s hours") % {"hours": engagement.course.effort_hours},
            recipient_name=engagement.learner.name,
            recipient_birth_date=engagement.learner.birth_date.isoformat() if engagement.learner.birth_date else "",
        )

        return await CertificateAward.issue(
            certificate_id=certificate_id,
            recipient_id=engagement.learner_id,
            content_type=await sync_to_async(ContentType.objects.get_for_model)(engagement),
            content_id=engagement.pk,
            data=data,
            verification_url=verification_url,
        )

    @classmethod
    async def grade(cls, *, course_id: str, learner_id: str, grader: "User | None" = None):
        engagement = await Engagement.objects.select_related("course__gradingpolicy").aget(
            course_id=course_id, learner_id=learner_id, active=True
        )
        criteria = await engagement.course.gradingpolicy.grading_criteria()

        context = engagement.issue_context()

        completion_criterion = next((c for c in criteria if c["model"] == "completion"), None)
        assessment_criteria = [c for c in criteria if c["model"] != "completion"]

        if completion_criterion:
            completion_agg = (
                await Lesson.objects
                .filter(course_id=completion_criterion["item_id"])
                .annotate(
                    media_count=Count("lessonmedia"),
                    passed_count=Count(
                        "lessonmedia",
                        filter=Q(
                            lessonmedia__media__watch__user_id=learner_id,
                            lessonmedia__media__watch__context=context,
                            lessonmedia__media__watch__passed=True,
                        ),
                    ),
                )
                .aaggregate(
                    total_lessons=Count("id"),
                    passed_lessons=Count("id", filter=Q(media_count__gt=0, passed_count=F("media_count"))),
                )
            )

            total = completion_agg["total_lessons"]
            passed = completion_agg["passed_lessons"]
            completion_rate = (passed * 100.0 / total) if total else 0.0
        else:
            completion_rate = 0.0

        assessment_results = {}
        if assessment_criteria:
            type_to_ids = defaultdict(list)
            for crit in assessment_criteria:
                key = (crit["app_label"], crit["model"])
                type_to_ids[key].append(crit["item_id"])

            qs_list = []
            for (app_label, model_name), ids in type_to_ids.items():
                model_class = apps.get_model(app_label, model_name)
                grade_class = ASSESSIBLE_GRADE_MODELS.get(model_class)
                if not grade_class:
                    raise ImproperlyConfigured(f"Cannot find grade model for {app_label}.{model_name}")

                pk_field = f"{model_class._meta.model_name}_id"
                qs = grade_class.objects.filter(
                    **{f"attempt__{pk_field}__in": ids},
                    attempt__learner_id=learner_id,
                    attempt__context=context,
                    attempt__active=True,
                    completed__isnull=False,
                    confirmed__isnull=False,
                ).values_list(f"attempt__{pk_field}", "score", "passed")
                qs_list.append(qs)

            if qs_list:
                qs_union = qs_list[0].union(*qs_list[1:]) if len(qs_list) > 1 else qs_list[0]
                assessment_results = {r[0]: {"score": r[1], "passed": r[2]} async for r in qs_union}

        total_score = 0.0
        total_weight = 0.0
        failed_exist = False
        details: dict[str, dict[str, bool | float | int] | None] = {}

        if completion_criterion:
            weight = completion_criterion["normalized_weight"]
            passed = completion_rate >= completion_criterion["passing_point"]
            details["completion"] = {
                "rate": completion_rate,
                "passing_point": completion_criterion["passing_point"],
                "passed": passed,
            }
            if weight > 0:
                total_score += completion_rate * weight / 100
                total_weight += weight
            if not passed:
                failed_exist = True

        for crit in assessment_criteria:
            result = assessment_results.get(crit["item_id"])
            if not result:
                details[crit["item_id"]] = None
                failed_exist = True
                continue
            score = result["score"]
            passed = result["passed"]
            details[crit["item_id"]] = {"score": score, "passing_point": crit["passing_point"], "passed": passed}
            weight = crit["normalized_weight"]
            if weight > 0:
                total_score += score * weight / 100
                total_weight += weight
            if not passed:
                failed_exist = True

        final_score = total_score if total_weight > 0 else 0.0

        gradebook, created = await Gradebook.objects.aupdate_or_create(
            engagement=engagement,
            defaults={
                "details": details,
                "score": final_score,
                "completion_rate": completion_rate,
                "passed": not failed_exist,
                "grader": grader,
            },
        )


@pghistory.track()
class Gradebook(TimeStampedMixin):
    engagement = OneToOneField(Engagement, CASCADE, verbose_name=_("Engagement"))
    details = JSONField(_("Details"))
    score = FloatField(_("Score"))
    completion_rate = FloatField(_("Completion Rate"))
    passed = BooleanField(_("Passed"))
    confirmed = BooleanNowField(_("Confirmed"), null=True, blank=True)
    note = TextField(_("Note"), blank=True, default="")
    grader = ForeignKey(User, CASCADE, null=True, blank=True, verbose_name=_("Grader"), related_name="+")

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Gradebook")
        verbose_name_plural = _("Gradebooks")

    @property
    def certificate_eligible(self):
        return bool(self.confirmed and self.passed)
