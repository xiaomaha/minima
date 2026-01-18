from celery import shared_task

from apps.warehouse.models import DailySnapshot, DailyUsageFact


@shared_task()
def collect_daily_data():
    DailyUsageFact.collect_daily_usage()
    DailySnapshot.collect_daily_snapshot()
