from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CourseConfig(AppConfig):
    name = "apps.course"
    verbose_name = _("Course")
