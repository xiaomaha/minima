from django.db import connection
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from apps.operation.models import Appeal, Inquiry, InquiryResponse
from apps.warehouse.models import DailySnapshot, DailyUsageFact


def dashboard_callback(request, context):
    recent_facts = list(DailyUsageFact.objects.order_by("-date")[:2])
    latest_snapshot = DailySnapshot.objects.order_by("-date").first()

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                (SELECT COUNT(*) 
                 FROM {inquiry_table} i
                 WHERE NOT EXISTS (
                     SELECT 1 FROM {response_table} r 
                     WHERE r.inquiry_id = i.id AND r.solved IS NOT NULL
                 )),
                (SELECT COUNT(*) FROM {appeal_table} WHERE closed IS NULL)
        """.format(
                inquiry_table=Inquiry._meta.db_table,
                response_table=InquiryResponse._meta.db_table,
                appeal_table=Appeal._meta.db_table,
            )
        )
        unsolved_inquiry, unclosed_appeal = cursor.fetchone()

    latest_fact = recent_facts[0] if len(recent_facts) > 0 else None
    previous_fact = recent_facts[1] if len(recent_facts) > 1 else None

    context["daily_usage"] = latest_fact
    context["daily_snapshot"] = latest_snapshot
    context["unsolved_inquiry_count"] = unsolved_inquiry
    context["unclosed_appeal_count"] = unclosed_appeal

    field_groups = [
        (_("Account"), ["registration_count", "login_count"]),
        (_("Operation"), ["attachment_count", "inquiry_count", "appeal_count", "message_sent_count", "comment_count"]),
        (_("Partner"), ["partner_count", "partner_member_count", "cohort_count"]),
        (_("Competency"), ["competency_goal_count", "badge_award_count", "certificate_award_count"]),
        (_("Content"), ["media_count", "public_access_media_count", "watch_count"]),
        (_("Survey"), ["survey_count", "survey_submission_count"]),
        (_("Quiz"), ["quiz_count", "quiz_submission_count"]),
        (
            _("Exam"),
            ["exam_count", "exam_submission_count", "exam_grade_completed_count", "exam_grade_confirmed_count"],
        ),
        (
            _("Assignment"),
            [
                "assignment_count",
                "assignment_submission_count",
                "assignment_grade_completed_count",
                "assignment_grade_confirmed_count",
            ],
        ),
        (
            _("Discussion"),
            [
                "discussion_count",
                "discussion_post_count",
                "discussion_grade_completed_count",
                "discussion_grade_confirmed_count",
            ],
        ),
        (_("Course"), ["course_count", "course_engagement_count", "course_grade_confirmed_count"]),
        (_("Learning"), ["enrollment_count", "catalog_count", "user_catalog_count", "cohort_catalog_count"]),
        (_("Store"), ["product_count", "coupon_count", "order_count", "payment_count", "refund_count"]),
        (_("Assistant"), ["assistant_chat_message_count"]),
    ]

    context["stat_groups"] = []
    for group_name, fields in field_groups:
        items = []
        for field_name in fields:
            field = DailyUsageFact._meta.get_field(field_name)
            current_value = getattr(latest_fact, field_name) if latest_fact else 0
            previous_value = getattr(previous_fact, field_name) if previous_fact else None

            items.append({
                "label": field.verbose_name,  # type: ignore
                "value": current_value,
                "diff": _format_diff(current_value, previous_value),
            })
        context["stat_groups"].append({"name": group_name, "items": items})

    context["snapshot_cards"] = [
        {"label": _("Total Accounts"), "value": latest_snapshot.active_account_count if latest_snapshot else 0},
        {"label": _("Active Enrollments"), "value": latest_snapshot.active_enrollment_count if latest_snapshot else 0},
        {"label": _("Courses Passed"), "value": latest_snapshot.course_passed_count if latest_snapshot else 0},
    ]

    return context


def _format_diff(current, previous):
    if previous is None:
        return ""

    diff = current - previous

    if diff > 0:
        return format_html('<span class="text-xs" style="color: #10b981;">(+{})</span>', diff)
    elif diff < 0:
        return format_html('<span class="text-xs" style="color: #ef4444;">({})</span>', diff)
    return '<span class="text-xs" style="color: #6b7280;">(0)</span>'
