from celery import shared_task
from django.utils import timezone

from apps.exam.models import Grade


@shared_task()
def grade_confirm_task():
    now = timezone.now()
    grades = list(
        Grade.objects.filter(
            completed__isnull=False, confirmed__isnull=True, attempt__active=True, attempt__lock__lte=now
        ).select_related("attempt__exam")
    )

    Grade.objects.filter(pk__in=[g.pk for g in grades]).update(confirmed=now)

    for grade in grades:
        grade.confirmed = now
        grade.on_confirmed_changed(None)
