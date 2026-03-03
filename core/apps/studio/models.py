import pghistory
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db.models import CASCADE, CharField, DateTimeField, ForeignKey, Model, TextField, UniqueConstraint
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from PIL.GifImagePlugin import TYPE_CHECKING

User = get_user_model()


@pghistory.track()
class Draft(Model):
    author = ForeignKey(User, CASCADE, verbose_name=_("Author"))
    edited = DateTimeField(_("Edited"), default=timezone.now)
    detail = TextField(_("Action"), blank=True, default="")

    content_type = ForeignKey(ContentType, CASCADE, verbose_name=_("Content type"))
    content_id = CharField(_("Content ID"), max_length=36)
    content = GenericForeignKey("content_type", "content_id")

    class Meta:
        verbose_name = _("Content Draft")
        verbose_name_plural = _("Content Drafts")
        constraints = [
            UniqueConstraint(fields=["author", "content_type", "content_id"], name="studio_draft_coty_coid_uniq")
        ]

    if TYPE_CHECKING:
        pgh_event_model: type[Model]
