from django.conf import settings

from apps.common.error import ErrorCode
from apps.sso.providers.github import GitHubProvider
from apps.sso.providers.google import GoogleProvider


def get_provider(provider_name: str):
    config = settings.SSO_PROVIDERS.get(provider_name)
    if not config:
        raise ValueError(ErrorCode.INVALID_SSO_PROVIDER)

    if provider_name == "google":
        return GoogleProvider(config)

    elif provider_name == "github":
        return GitHubProvider(config)

    raise ValueError(ErrorCode.INVALID_SSO_PROVIDER)
