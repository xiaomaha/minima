from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class SSOConfig(AppConfig):
    name = "apps.sso"
    verbose_name = _("SSO")
