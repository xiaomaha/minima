import logging

from asgiref.sync import async_to_sync
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _
from unfold.decorators import action

from apps.common.admin import HiddenModelAdmin, ModelAdmin, ReadOnlyModelAdmin, TabularInline
from apps.common.util import AuthenticatedRequest
from apps.content.models import Media, Note, PublicAccessMedia, Subtitle, Watch

log = logging.getLogger(__name__)


@admin.register(Media)
class MediaAdmin(ModelAdmin[Media]):
    exclude = ("quizzes",)

    class SubtitleInline(TabularInline[Subtitle]):
        model = Subtitle
        exclude = ("body",)

    class PublicAccessMediaInline(TabularInline[PublicAccessMedia]):
        model = PublicAccessMedia
        verbose_name = _("Public Access")

    class QuizInline(TabularInline[Media.quizzes.through]):
        model = Media.quizzes.through
        verbose_name = _("Quiz")

    inlines = (PublicAccessMediaInline, SubtitleInline, QuizInline)

    actions_submit_line = ["create_quiz"]

    @action(description=_("Create Quiz"), permissions=["create_quiz"])  # type: ignore
    def create_quiz(self, request: HttpRequest, obj: Media):
        try:
            async_to_sync(obj.create_quiz)()
            self.message_user(request, "Quiz created", messages.SUCCESS)
        except ValidationError as e:
            self.message_user(request, str(e), messages.ERROR)

    def has_create_quiz_permission(self, request: AuthenticatedRequest, object_id: str | int):
        return request.user.is_superuser


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
