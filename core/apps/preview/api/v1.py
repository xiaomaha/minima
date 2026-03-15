import secrets

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.http import HttpResponse
from django.utils.translation import gettext as _
from ninja import Router

from apps.account.api.schema import UserSchema
from apps.account.models import User
from apps.common.error import ErrorCode
from apps.common.policy import PlatformRealm
from apps.common.util import HttpRequest
from apps.preview.models import PreviewUser

router = Router(by_alias=True)

_PREVIEW_OTT_TTL: int = 60  # 1 minute
_PREVIEW_OTT_PREFIX = "preview:ott:"


@router.post("/preview/session", response=str)
async def create_preview_session(request: HttpRequest):
    if not any(r in request.roles for r in PlatformRealm):
        raise ValueError(ErrorCode.PERMISSION_DENIED)

    ott = secrets.token_urlsafe(32)
    await cache.aset(f"{_PREVIEW_OTT_PREFIX}{ott}", request.auth, timeout=_PREVIEW_OTT_TTL)
    return ott


@router.get("/preview/exchange/{ott}", auth=None, response=UserSchema)
async def exchange_preview_session(request: HttpRequest, response: HttpResponse, ott: str):
    ott_auth = await cache.aget(f"{_PREVIEW_OTT_PREFIX}{ott}")
    if not ott_auth:
        raise ValueError(ErrorCode.INVALID_TOKEN)

    await cache.adelete(f"{_PREVIEW_OTT_PREFIX}{ott}")

    preview_user, created = await User.objects.aget_or_create(
        email=f"preview+{ott_auth}@preview.worker",
        defaults={"name": _("Preview"), "nickname": "?", "is_active": True, "password": make_password(None)},
    )

    if created:
        await PreviewUser.objects.acreate(user=preview_user, creator_id=ott_auth)
        await preview_user.groups.aadd(await Group.objects.aget(name=PlatformRealm.PREVIEW))

    user = await User.get_user(email=preview_user.email, is_active=True, annotate=True)
    user.agreement_required = False
    await user.token_login(request=request, response=response, skip_password_check=True)

    return user
