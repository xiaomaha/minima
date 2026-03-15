from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class OperationConfig(AppConfig):
    name = "apps.operation"
    verbose_name = _("Operation")
