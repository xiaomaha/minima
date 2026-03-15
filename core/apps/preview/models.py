from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import CASCADE, Model
from django.utils.translation import gettext_lazy as _

User = get_user_model()


class PreviewUser(Model):
    created = models.DateTimeField(_("Created"), auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, CASCADE, verbose_name=_("User"), related_name="+")
    creator = models.ForeignKey(User, CASCADE, verbose_name=_("Creator"), related_name="+")

    class Meta:
        verbose_name = _("Preview User")
        verbose_name_plural = _("Preview Users")
