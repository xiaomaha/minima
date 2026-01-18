import logging
import time
from datetime import datetime, timedelta

from django.db import connection
from django.db.models import DateField, DurationField, IntegerField, Model
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.account.models import Token as LoginToken
from apps.account.models import User
from apps.assignment.models import Assignment
from apps.assignment.models import Grade as AssignmentGrade
from apps.assignment.models import Submission as AssignmentSubmission
from apps.assistant.models import ChatMessage as AssistantChatMessage
from apps.competency.models import BadgeAward, CertificateAward, CompetencyGoal
from apps.content.models import Media, PublicAccessMedia, Watch
from apps.course.models import Course
from apps.course.models import Engagement as CourseEngagement
from apps.course.models import Gradebook as CourseGradebook
from apps.discussion.models import Discussion
from apps.discussion.models import Grade as DiscussionGrade
from apps.discussion.models import Post as DiscussionPost
from apps.exam.models import Exam
from apps.exam.models import Grade as ExamGrade
from apps.exam.models import Submission as ExamSubmission
from apps.learning.models import Catalog, CohortCatalog, Enrollment, UserCatalog
from apps.operation.models import Appeal, Attachment, Comment, Inquiry, Message
from apps.partner.models import Cohort, Partner
from apps.partner.models import Employee as PartnerEmployee
from apps.quiz.models import Quiz
from apps.quiz.models import Submission as QuizSubmission
from apps.store.models import Coupon, Order, Payment, Product, Refund
from apps.survey.models import Submission as SurveySubmission
from apps.survey.models import Survey

log = logging.getLogger(__name__)


def _timezone_date(from_days_ago: int = 1):
    today = timezone.now().date() - timedelta(days=from_days_ago)
    start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.get_default_timezone())
    end = start + timedelta(days=1)
    return today, start, end


class ExecutionMetricsMixin(Model):
    duration = DurationField(_("Execution Duration (seconds)"))

    class Meta:
        abstract = True


class DailySnapshot(ExecutionMetricsMixin):
    date = DateField(_("Date"), unique=True)

    active_account_count = IntegerField(_("Total Account"), default=0)
    active_enrollment_count = IntegerField(_("Total Enrollment"), default=0)
    course_passed_count = IntegerField(_("Course Passed"), default=0)

    class Meta:
        verbose_name = _("Daily Snapshot")
        verbose_name_plural = _("Daily Snapshots")

    @classmethod
    def collect_daily_snapshot(cls, *, from_days_ago: int = 1):
        start_time = time.time()
        today, start, end = _timezone_date(from_days_ago)

        query = """
            INSERT INTO {table} (date, active_account_count, active_enrollment_count, course_passed_count, duration)
            VALUES (
                %s,
                (SELECT COUNT(*) FROM {account_table} WHERE is_active = TRUE),
                (SELECT COUNT(*) FROM {enrollment_table} WHERE start <= %s AND archive >= %s AND active = TRUE),
                (SELECT COUNT(*) FROM {gradebook_table} WHERE passed = TRUE AND confirmed <= %s),
                INTERVAL '0'
            )
            ON CONFLICT (date) DO UPDATE SET
                active_account_count = EXCLUDED.active_account_count,
                active_enrollment_count = EXCLUDED.active_enrollment_count,
                course_passed_count = EXCLUDED.course_passed_count,
                duration = EXCLUDED.duration
        """.format(
            table=cls._meta.db_table,
            account_table=User._meta.db_table,
            enrollment_table=Enrollment._meta.db_table,
            gradebook_table=CourseGradebook._meta.db_table,
        )

        with connection.cursor() as cursor:
            cursor.execute(query, [today, today, today, today])

        duration = timedelta(seconds=time.time() - start_time)
        cls.objects.filter(date=today).update(duration=duration)

        log.info(f"Collected daily snapshot for {today} in {duration.total_seconds():.2f}s")


class DailyUsageFact(ExecutionMetricsMixin):
    date = DateField(_("Date"), unique=True)

    # account
    registration_count = IntegerField(_("Registration"), default=0)
    login_count = IntegerField(_("Login"), default=0)

    # operation
    attachment_count = IntegerField(_("Attachment"), default=0)
    inquiry_count = IntegerField(_("Inquiry"), default=0)
    appeal_count = IntegerField(_("Appeal"), default=0)
    message_sent_count = IntegerField(_("Message Sent"), default=0)
    comment_count = IntegerField(_("Comment"), default=0)

    # partner
    partner_count = IntegerField(_("Partner"), default=0)
    partner_employee_count = IntegerField(_("Partner Employee"), default=0)
    cohort_count = IntegerField(_("Cohort"), default=0)

    # competency
    competency_goal_count = IntegerField(_("Competency Goal"), default=0)
    badge_award_count = IntegerField(_("Badge Award"), default=0)
    certificate_award_count = IntegerField(_("Certificate Award"), default=0)

    # content
    media_count = IntegerField(_("Media"), default=0)
    public_access_media_count = IntegerField(_("Public Access Media"), default=0)
    watch_count = IntegerField(_("Watch"), default=0)

    # survey
    survey_count = IntegerField(_("Survey"), default=0)
    survey_submission_count = IntegerField(_("Survey Submission"), default=0)

    # quiz
    quiz_count = IntegerField(_("Quiz"), default=0)
    quiz_submission_count = IntegerField(_("Quiz Submission"), default=0)

    # exam
    exam_count = IntegerField(_("Exam"), default=0)
    exam_submission_count = IntegerField(_("Exam Submission"), default=0)
    exam_grade_completed_count = IntegerField(_("Exam Grade Completed"), default=0)
    exam_grade_confirmed_count = IntegerField(_("Exam Grade Confirmed"), default=0)

    # assignment
    assignment_count = IntegerField(_("Assignment"), default=0)
    assignment_submission_count = IntegerField(_("Assignment Submission"), default=0)
    assignment_grade_completed_count = IntegerField(_("Assignment Grade Completed"), default=0)
    assignment_grade_confirmed_count = IntegerField(_("Assignment Grade Confirmed"), default=0)

    # discussion
    discussion_count = IntegerField(_("Discussion"), default=0)
    discussion_post_count = IntegerField(_("Discussion Post"), default=0)
    discussion_grade_completed_count = IntegerField(_("Discussion Grade Completed"), default=0)
    discussion_grade_confirmed_count = IntegerField(_("Discussion Grade Confirmed"), default=0)

    # course
    course_count = IntegerField(_("Course"), default=0)
    course_engagement_count = IntegerField(_("Course Engagement"), default=0)
    course_grade_confirmed_count = IntegerField(_("Course Grade Confirmed"), default=0)

    # learnnig
    enrollment_count = IntegerField(_("Enrollment"), default=0)
    catalog_count = IntegerField(_("Catalog"), default=0)
    user_catalog_count = IntegerField(_("User Catalog"), default=0)
    cohort_catalog_count = IntegerField(_("Cohort Catalog"), default=0)

    # store
    product_count = IntegerField(_("Product"), default=0)
    coupon_count = IntegerField(_("Coupon"), default=0)
    order_count = IntegerField(_("Order"), default=0)
    payment_count = IntegerField(_("Payment"), default=0)
    refund_count = IntegerField(_("Refund"), default=0)

    # assistant
    assistant_chat_message_count = IntegerField(_("Assistant Chat Message"), default=0)

    class Meta:
        verbose_name = _("Daily Usage Fact")
        verbose_name_plural = _("Daily Usage Facts")

    # fact field name, source model name, source date field name, additional conditions Q
    COLLECTING_MAP: list[tuple[str, type[Model], str]] = [
        # account
        ("registration_count", User, "created"),
        ("login_count", LoginToken, "created"),
        # operation
        ("attachment_count", Attachment, "created"),
        ("inquiry_count", Inquiry, "created"),
        ("appeal_count", Appeal, "created"),
        ("message_sent_count", Message, "sent"),
        ("comment_count", Comment, "created"),
        # partner
        ("partner_count", Partner, "created"),
        ("partner_employee_count", PartnerEmployee, "created"),
        ("cohort_count", Cohort, "created"),
        # competency
        ("competency_goal_count", CompetencyGoal, "created"),
        ("badge_award_count", BadgeAward, "created"),
        ("certificate_award_count", CertificateAward, "created"),
        # content
        ("media_count", Media, "created"),
        ("public_access_media_count", PublicAccessMedia, "created"),
        ("watch_count", Watch, "created"),
        # survey
        ("survey_count", Survey, "created"),
        ("survey_submission_count", SurveySubmission, "created"),
        # quiz
        ("quiz_count", Quiz, "created"),
        ("quiz_submission_count", QuizSubmission, "created"),
        # exam
        ("exam_count", Exam, "created"),
        ("exam_submission_count", ExamSubmission, "created"),
        ("exam_grade_completed_count", ExamGrade, "completed"),
        ("exam_grade_confirmed_count", ExamGrade, "confirmed"),
        # assignment
        ("assignment_count", Assignment, "created"),
        ("assignment_submission_count", AssignmentSubmission, "created"),
        ("assignment_grade_completed_count", AssignmentGrade, "completed"),
        ("assignment_grade_confirmed_count", AssignmentGrade, "confirmed"),
        # discussion
        ("discussion_count", Discussion, "created"),
        ("discussion_post_count", DiscussionPost, "created"),
        ("discussion_grade_completed_count", DiscussionGrade, "completed"),
        ("discussion_grade_confirmed_count", DiscussionGrade, "confirmed"),
        # course
        ("course_count", Course, "created"),
        ("course_engagement_count", CourseEngagement, "created"),
        ("course_grade_confirmed_count", CourseGradebook, "confirmed"),
        # learning
        ("enrollment_count", Enrollment, "enrolled"),
        ("catalog_count", Catalog, "created"),
        ("user_catalog_count", UserCatalog, "created"),
        ("cohort_catalog_count", CohortCatalog, "created"),
        # store
        ("product_count", Product, "created"),
        ("coupon_count", Coupon, "created"),
        ("order_count", Order, "created"),
        ("payment_count", Payment, "created"),
        ("refund_count", Refund, "created"),
        # assistant
        ("assistant_chat_message_count", AssistantChatMessage, "created"),
    ]

    @classmethod
    def collect_daily_usage(cls, *, from_days_ago: int = 1):
        start_time = time.time()
        today, start, end = _timezone_date(from_days_ago)

        subqueries = []
        for field_name, model, date_field in cls.COLLECTING_MAP:
            subqueries.append(
                f"(SELECT COUNT(*) FROM {model._meta.db_table} WHERE {date_field} >= %s AND {date_field} < %s)"
            )

        fields = [field_name for field_name, _, _ in cls.COLLECTING_MAP]

        query = f"""
            INSERT INTO {cls._meta.db_table} (date, {", ".join(fields)}, duration)
            VALUES (%s, {", ".join(subqueries)}, INTERVAL '0')
            ON CONFLICT (date) DO UPDATE SET
            {", ".join(f"{f} = EXCLUDED.{f}" for f in fields)},
            duration = EXCLUDED.duration
        """

        params = [today] + [start, end] * len(cls.COLLECTING_MAP)

        with connection.cursor() as cursor:
            cursor.execute(query, params)

        duration = timedelta(seconds=time.time() - start_time)
        cls.objects.filter(date=today).update(duration=duration)

        log.info(f"Collected daily usage for {today} in {duration.total_seconds():.2f}s")
