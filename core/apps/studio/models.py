import pghistory
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db.models import CASCADE, CharField, ForeignKey, UniqueConstraint
from django.utils.translation import gettext_lazy as _

from apps.common.models import TimeStampedMixin

User = get_user_model()


@pghistory.track()
class Draft(TimeStampedMixin):
    author = ForeignKey(User, CASCADE, verbose_name=_("Author"))

    content_type = ForeignKey(ContentType, CASCADE, verbose_name=_("Content type"))
    content_id = CharField(_("Content ID"), max_length=36)
    content = GenericForeignKey("content_type", "content_id")

    class Meta:
        verbose_name = _("Content Draft")
        verbose_name_plural = _("Content Drafts")
        constraints = [UniqueConstraint(fields=["content_type", "content_id"], name="studio_draft_coty_coid_uniq")]
