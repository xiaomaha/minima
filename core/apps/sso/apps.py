from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class SSOConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sso"
    verbose_name = _("SSO")
