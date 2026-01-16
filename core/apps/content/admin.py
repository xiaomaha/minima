import logging

from django.contrib import admin
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _

from apps.common.admin import HiddenModelAdmin, ModelAdmin, ReadOnlyModelAdmin, TabularInline
from apps.content.models import Media, Note, PublicAccessMedia, Subtitle, Watch

log = logging.getLogger(__name__)


@admin.register(Media)
class MediaAdmin(ModelAdmin[Media]):
    class SubtitleInline(TabularInline[Subtitle]):
        model = Subtitle
        exclude = ("body",)

    class PublicAccessMediaInline(TabularInline[PublicAccessMedia]):
        model = PublicAccessMedia
        verbose_name = _("Public Access")

    inlines = (PublicAccessMediaInline, SubtitleInline)


@admin.register(PublicAccessMedia)
class PublicAccessMediaAdmin(HiddenModelAdmin[PublicAccessMedia]):
    pass


@admin.register(Subtitle)
class SubtitleAdmin(HiddenModelAdmin[Subtitle]):
    pass


@admin.register(Watch)
class WatchAdmin(ReadOnlyModelAdmin[Watch]):
    def get_list_display(self, request: HttpRequest):
        return tuple(str(field) for field in super().get_list_display(request) if field not in ("watch_bits",))


@admin.register(Note)
class NoteAdmin(ReadOnlyModelAdmin[Note]):
    pass
