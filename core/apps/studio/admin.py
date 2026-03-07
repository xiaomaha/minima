from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from apps.common.admin import ModelAdmin, ReadOnlyHiddenModelAdmin, ReadOnlyTabularInline
from apps.studio.models import Editing


@admin.register(Editing)
class EditingAdmin(ModelAdmin):
    class EditingEventInline(ReadOnlyTabularInline[Editing.pgh_event_model]):
        model = Editing.pgh_event_model
        verbose_name = _("Editing History")
        verbose_name_plural = _("Editing Histories")
        ordering = ("-edited",)

        def get_queryset(self, request):
            return super().get_queryset(request).select_related("pgh_context", "author", "content_type")

    inlines = (EditingEventInline,)


@admin.register(Editing.pgh_event_model)
class EditingEventAdmin(ReadOnlyHiddenModelAdmin[Editing.pgh_event_model]):
    pass
