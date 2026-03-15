from time import time

from django.conf import settings
from django.utils import timezone
from django.utils.decorators import async_only_middleware
from jwt.exceptions import InvalidTokenError

from apps.account.models import BlacklistedToken, auth_cookie_options
from apps.common.error import ErrorCode
from apps.common.policy import PlatformRealm
from apps.common.util import HttpRequest, decode_token, encode_token, get_realm


def check_realm(request: HttpRequest):
    realm = get_realm(request)
    if realm != settings.PLATFORM_STUDENT_REALM:
        if realm not in request.roles and realm not in request.realms:
            raise ValueError(ErrorCode.INVALID_REALM)


@async_only_middleware
def cookie_auth_middleware(get_response):
    async def middleware(request: HttpRequest):
        request.auth = ""
        request.roles = []
        request.realms = []

        if get_realm(request) == PlatformRealm.PREVIEW:
            try:
                access_token = request.COOKIES.get(settings.ACCESS_TOKEN_NAME)
                if access_token:
                    decoded = decode_token(access_token)
                    request.auth = decoded.get("sub")
                    request.roles = decoded.get("roles", [])
                    request.realms = decoded.get("realms", [])
            except InvalidTokenError:
                pass
            return await get_response(request)

        try:
            refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_NAME)
            if not refresh_token:
                return await get_response(request)

            access_token = request.COOKIES.get(settings.ACCESS_TOKEN_NAME)
            if access_token:
                try:
                    decoded = decode_token(access_token)
                    request.roles = decoded.get("roles", [])
                    request.realms = decoded.get("realms", [])
                    check_realm(request)
                    request.auth = decoded.get("sub")
                    return await get_response(request)
                except InvalidTokenError:
                    pass

            if await BlacklistedToken.objects.filter(token=refresh_token, expires__gt=timezone.now()).aexists():
                return await get_response(request)

            decoded = decode_token(refresh_token)
            user_id = decoded.get("sub")
            roles = decoded.get("roles", [])
            realms = decoded.get("realms", [])
            request.roles = roles
            request.realms = realms
            check_realm(request)

            request.auth = user_id
            max_age = settings.ACCESS_TOKEN_EXPIRE_SECONDS
            expires = int(time()) + max_age
            access_token = encode_token({
                "sub": user_id,
                "exp": expires,
                "type": "access",
                "roles": roles,
                "realms": realms,
            })
            options = auth_cookie_options()
            response = await get_response(request)
            response.set_cookie(key=settings.ACCESS_TOKEN_NAME, value=access_token, max_age=max_age, **options)
            return response

        except InvalidTokenError:
            return await get_response(request)

    return middleware
