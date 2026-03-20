from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.preview.models import PreviewUser

User = get_user_model()

PREVIEW_ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 1


@shared_task()
def cleanup_preview_data():
    cutoff = timezone.now() - timedelta(seconds=PREVIEW_ACCESS_TOKEN_EXPIRE_SECONDS)
    user_ids = PreviewUser.objects.filter(created__lt=cutoff).values_list("user_id", flat=True)
    return User.objects.filter(pk__in=user_ids).delete()
