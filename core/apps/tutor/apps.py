from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class TutorConfig(AppConfig):
    name = "apps.tutor"
    verbose_name = _("Tutor")
