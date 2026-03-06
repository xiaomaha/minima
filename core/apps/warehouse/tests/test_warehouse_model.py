import pytest

from apps.warehouse.models import DailySnapshot, DailyUsageFact


@pytest.mark.django_db
def test_daily_snapshot():
    DailySnapshot.collect_daily_snapshot()
    DailySnapshot.collect_daily_snapshot()
    assert DailySnapshot.objects.count() == 1


@pytest.mark.django_db
def test_daily_usage():
    DailyUsageFact.collect_daily_usage()
    assert DailyUsageFact.objects.count() == 1
