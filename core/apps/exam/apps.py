from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class ExamConfig(AppConfig):
    name = "apps.exam"
    verbose_name = _("Exam")
