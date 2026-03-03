from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.assignment.models import Attempt as AssignmentAttempt
from apps.content.models import Watch as MediaWatch
from apps.course.models import Engagement as CourseEngagement
from apps.discussion.models import Attempt as DiscussionAttempt
from apps.exam.models import Attempt as ExamAttempt
from apps.quiz.models import Attempt as QuizAttempt
from apps.survey.models import Submission as SurveySubmission

preview_data_models = [
    QuizAttempt,
    SurveySubmission,
    ExamAttempt,
    AssignmentAttempt,
    DiscussionAttempt,
    CourseEngagement,
    MediaWatch,
]

CLEANUP_THRESHOLD_HOURS = 1


@shared_task()
def cleanup_preview_data():
    threshold = timezone.now() - timedelta(hours=CLEANUP_THRESHOLD_HOURS)
    deleted = {}

    for M in preview_data_models:
        num, model_num = M.objects.filter(mode="preview", start__lte=threshold).delete()
        deleted[M._meta.model_name] = num, model_num

    return deleted
