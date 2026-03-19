from celery import shared_task
from django.utils import timezone

from apps.course.models import Gradebook


@shared_task()
def gradebook_confirm_task():
    now = timezone.now()
    gradebooks = list(
        Gradebook.objects.filter(
            confirmed__isnull=True, engagement__active=True, engagement__lock__lte=now
        ).select_related("engagement__course")
    )

    Gradebook.objects.filter(pk__in=[g.pk for g in gradebooks]).update(confirmed=now)

    for gradebook in gradebooks:
        gradebook.confirmed = now
        gradebook.on_confirmed_changed(None)
