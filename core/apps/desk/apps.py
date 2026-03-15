from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class DeskConfig(AppConfig):
    name = "apps.desk"
    verbose_name = _("Desk")
