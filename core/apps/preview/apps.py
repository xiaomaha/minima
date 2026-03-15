from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PreviewConfig(AppConfig):
    name = "apps.preview"
    verbose_name = _("Preview")
