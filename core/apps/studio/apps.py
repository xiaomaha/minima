from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class StudioConfig(AppConfig):
    name = "apps.studio"
    verbose_name = _("Studio")
