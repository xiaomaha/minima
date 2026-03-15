from django.contrib import admin

from apps.common.admin import HiddenModelAdmin
from apps.preview.models import PreviewUser


@admin.register(PreviewUser)
class PreviewUserAdmin(HiddenModelAdmin):
    pass
