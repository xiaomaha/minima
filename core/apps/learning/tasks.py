from datetime import timedelta

from celery import shared_task
from django.db import connection
from django.utils import timezone

from apps.assignment.models import Attempt as AssignmentAttempt
from apps.common.util import RealmChoices
from apps.content.models import Watch
from apps.course.models import Engagement as CourseEngagement
from apps.discussion.models import Attempt as DiscussionAttempt
from apps.exam.models import Attempt as ExamAttempt
from apps.operation.models import Appeal
from apps.quiz.models import Attempt as QuizAttempt
from apps.survey.models import Submission as SurveySubmission

REALM_DATA_MODELS = [
    QuizAttempt,
    SurveySubmission,
    ExamAttempt,
    AssignmentAttempt,
    DiscussionAttempt,
    CourseEngagement,
    Watch,
]

CLEANUP_THRESHOLD_HOURS = 1


@shared_task()
def cleanup_testing_data():
    threshold = timezone.now() - timedelta(hours=CLEANUP_THRESHOLD_HOURS)
    non_student_realms = tuple(RealmChoices.non_student_realms())
    deleted = {}

    assignment_attempt_table = AssignmentAttempt._meta.db_table
    discussion_attempt_table = DiscussionAttempt._meta.db_table
    exam_attempt_table = ExamAttempt._meta.db_table
    exam_attempt_questions_table = ExamAttempt.questions.through._meta.db_table

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            DELETE FROM operation_appeal
            WHERE (question_type_id, question_id, learner_id) IN (
                SELECT ct.id, a.question_id, a.learner_id
                FROM {assignment_attempt_table} a
                CROSS JOIN (SELECT id FROM django_content_type WHERE app_label='assignment' AND model='question') ct
                WHERE a.realm = ANY(%s) AND a.started <= %s
                UNION
                SELECT ct.id, a.question_id, a.learner_id
                FROM {discussion_attempt_table} a
                CROSS JOIN (SELECT id FROM django_content_type WHERE app_label='discussion' AND model='question') ct
                WHERE a.realm = ANY(%s) AND a.started <= %s
                UNION
                SELECT ct.id, eq.question_id, a.learner_id
                FROM {exam_attempt_table} a
                JOIN {exam_attempt_questions_table} eq ON eq.attempt_id = a.id
                CROSS JOIN (SELECT id FROM django_content_type WHERE app_label='exam' AND model='question') ct
                WHERE a.realm = ANY(%s) AND a.started <= %s
            )
        """,
            [
                list(non_student_realms),
                threshold,
                list(non_student_realms),
                threshold,
                list(non_student_realms),
                threshold,
            ],
        )
        deleted[Appeal._meta.model.__name__.lower()] = cursor.rowcount

    for M in REALM_DATA_MODELS:
        time_field = "modified" if M is Watch else "started"
        num, model_num = M.objects.filter(realm__in=non_student_realms, **{f"{time_field}__lte": threshold}).delete()
        deleted[M.__name__.lower()] = num

    return deleted
