from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from apps.common.admin import ModelAdmin, ReadOnlyHiddenModelAdmin, ReadOnlyTabularInline
from apps.studio.models import Draft


@admin.register(Draft)
class DraftAdmin(ModelAdmin):
    class DraftEventInline(ReadOnlyTabularInline[Draft.pgh_event_model]):
        model = Draft.pgh_event_model
        verbose_name = _("Draft History")
        verbose_name_plural = _("Draft Histories")
        ordering = ("-edited",)

        def get_queryset(self, request):
            return super().get_queryset(request).select_related("pgh_context", "author", "content_type")

    inlines = (DraftEventInline,)


@admin.register(Draft.pgh_event_model)
class DraftEventAdmin(ReadOnlyHiddenModelAdmin[Draft.pgh_event_model]):
    pass
