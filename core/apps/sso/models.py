import secrets
from datetime import timedelta
from typing import TYPE_CHECKING
from urllib.parse import urlparse

from django.conf import settings
from django.db.models import (
    CASCADE,
    CharField,
    DateTimeField,
    EmailField,
    ForeignKey,
    Index,
    UniqueConstraint,
    URLField,
)
from django.http import HttpResponse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.account.models import User
from apps.common.error import ErrorCode
from apps.common.models import TimeStampedMixin, TuidMixin
from apps.common.util import HttpRequest
from apps.sso.providers.factory import get_provider


class SSOAccount(TuidMixin, TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    provider = CharField(_("Provider"), max_length=255)
    provider_user_id = CharField(_("Provider User ID"), max_length=255)
    email = EmailField(_("Email"))

    class Meta:
        verbose_name = _("SSO Account")
        verbose_name_plural = _("SSO Accounts")
        constraints = [UniqueConstraint(fields=["provider", "provider_user_id"], name="sso_ssoaccount_pr_prus_uniq")]
        indexes = [Index(fields=["user", "provider"])]

    def __str__(self):
        return f"{self.email} - {self.provider}"


class SSOSession(TuidMixin, TimeStampedMixin):
    state = CharField(_("State"), max_length=255, unique=True)
    nonce = CharField(_("Nonce"), max_length=255)
    provider = CharField(_("Provider"), max_length=255)
    redirect_to = URLField(_("Redirect To"), max_length=255)
    user = ForeignKey(User, CASCADE, verbose_name=_("User"), null=True, blank=True)
    expires = DateTimeField(_("Expires"))

    class Meta:
        verbose_name = _("SSO Session")
        verbose_name_plural = _("SSO Sessions")

    if TYPE_CHECKING:
        user_id: str

    def __str__(self):
        return f"{self.provider} - {self.state[:8]}"

    @classmethod
    async def authorization_url(cls, *, provider: str, redirect_to: str, redirect_uri: str, user_id: str | None = None):
        parsed = urlparse(redirect_to)
        if f"{parsed.scheme}://{parsed.netloc}" not in settings.ALLOWED_REDIRECT_ORIGINS:
            raise ValueError(ErrorCode.INVALID_REDIRECT_URL)

        session = await cls.objects.acreate(
            state=secrets.token_urlsafe(32),
            nonce=secrets.token_urlsafe(32),
            provider=provider,
            redirect_to=redirect_to,
            user_id=user_id,
            expires=timezone.now() + timedelta(seconds=settings.SSO_SESSION_EXPIRE_SECONDS),
        )

        return await get_provider(provider).get_authorization_url(
            state=session.state, nonce=session.nonce, redirect_uri=redirect_uri
        )

    @classmethod
    async def callback(
        cls, *, state: str, code: str, provider: str, redirect_uri: str, request: HttpRequest, response: HttpResponse
    ):
        session = await cls.objects.filter(state=state, provider=provider).aget()
        if session.expires < timezone.now():
            raise ValueError(ErrorCode.SSO_SESSION_EXPIRED)

        provider_instance = get_provider(provider)
        tokens = await provider_instance.exchange_code(code=code, redirect_uri=redirect_uri)
        user_info = await provider_instance.get_user_info(tokens=tokens, nonce=session.nonce)

        sso_account = (
            await SSOAccount.objects
            .filter(provider=provider, provider_user_id=user_info["provider_user_id"])
            .select_related("user")
            .afirst()
        )

        if session.user_id:
            if sso_account:
                if sso_account.user_id != session.user_id:
                    raise ValueError(ErrorCode.SSO_ACCOUNT_ALREADY_LINKED)
            else:
                await SSOAccount.objects.acreate(
                    user_id=session.user_id,
                    provider=provider,
                    provider_user_id=user_info["provider_user_id"],
                    email=user_info["email"],
                )

            await session.adelete()
            return session.redirect_to

        if not sso_account:
            user, created = await User.objects.aget_or_create(
                email=user_info["email"], defaults={"name": user_info["name"], "is_active": True}
            )
            if not created:
                raise ValueError(ErrorCode.EMAIL_ALREADY_EXISTS)

            sso_account = await SSOAccount.objects.acreate(
                user=user, provider=provider, provider_user_id=user_info["provider_user_id"], email=user_info["email"]
            )

        await sso_account.user.token_login(request=request, response=response, skip_password_check=True)
        await session.adelete()
        return session.redirect_to
