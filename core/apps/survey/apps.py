from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class SurveyConfig(AppConfig):
    name = "apps.survey"
    verbose_name = _("Survey")
