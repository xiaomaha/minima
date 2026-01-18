from django.contrib import admin

from apps.common.admin import ReadOnlyModelAdmin
from apps.warehouse.models import DailySnapshot, DailyUsageFact


@admin.register(DailySnapshot)
class DailySnapshotAdmin(ReadOnlyModelAdmin[DailySnapshot]):
    pass


@admin.register(DailyUsageFact)
class WarehouseAdmin(ReadOnlyModelAdmin[DailyUsageFact]):
    pass
