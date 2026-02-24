from django.contrib import admin

from apps.common.admin import ModelAdmin
from apps.studio.models import Draft


@admin.register(Draft)
class DraftAdmin(ModelAdmin):
    pass
