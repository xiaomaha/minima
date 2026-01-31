from django.contrib import admin

from apps.common.admin import ModelAdmin
from apps.sso.models import SSOAccount, SSOSession


@admin.register(SSOAccount)
class SSOAccountAdmin(ModelAdmin[SSOAccount]):
    pass


@admin.register(SSOSession)
class SSOSessionAdmin(ModelAdmin[SSOSession]):
    pass
