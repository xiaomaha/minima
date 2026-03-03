import pghistory
from celery import shared_task

from apps.tracking.models import HotEvent


@shared_task()
def sync_hot_event():
    with pghistory.context(task="sync_hot_event"):
        return HotEvent.sync()


@shared_task()
def cleanup_hot_event():
    with pghistory.context(task="cleanup_hot_event"):
        return HotEvent.cleanup()
