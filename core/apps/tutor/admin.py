from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from apps.common.admin import ModelAdmin, ReadOnlyHiddenModelAdmin, ReadOnlyTabularInline
from apps.tutor.models import Allocation


@admin.register(Allocation)
class AllocationAdmin(ModelAdmin):
    class AllocationEventInline(ReadOnlyTabularInline[Allocation.pgh_event_model]):
        model = Allocation.pgh_event_model
        verbose_name = _("Allocation History")
        verbose_name_plural = _("Allocation Histories")

        def get_queryset(self, request):
            return super().get_queryset(request).select_related("pgh_context", "tutor", "content_type")

    inlines = (AllocationEventInline,)


@admin.register(Allocation.pgh_event_model)
class AllocationEventAdmin(ReadOnlyHiddenModelAdmin[Allocation.pgh_event_model]):
    pass
