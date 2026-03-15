from django.db.models import TextChoices
from django.utils.translation import gettext_lazy as _


class PlatformRealm(TextChoices):
    STUDIO = "studio", _("Studio")
    TUTOR = "tutor", _("Tutor")
    DESK = "desk", _("Desk")
    PREVIEW = "preview", _("Preview")
