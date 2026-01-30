from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from django.http import HttpResponse
from django.urls import reverse
from ninja import Router

from apps.common.error import ErrorCode
from apps.common.util import HttpRequest
from apps.sso.api.schema import AuthorizeResponseSchema, AuthorizeSchema, SSOAccountSchema
from apps.sso.models import SSOAccount, SSOSession

router = Router(by_alias=True)


def _callback_uri(request, provider: str):
    path = reverse("api-v1:callback", kwargs={"provider": provider})
    return request.build_absolute_uri(path)


@router.post("/{provider}/authorize", response=AuthorizeResponseSchema, auth=None)
async def authorize(request: HttpRequest, provider: str, data: AuthorizeSchema):
    return {
        "authorization_url": await SSOSession.authorization_url(
            provider=provider, redirect_to=data.redirect_to, redirect_uri=_callback_uri(request, provider)
        )
    }


@router.get("/{provider}/callback", auth=None, url_name="callback")
async def callback(request: HttpRequest, response: HttpResponse, provider: str, code: str, state: str):
    try:
        redirect_url = await SSOSession.callback(
            state=state,
            code=code,
            provider=provider,
            request=request,
            response=response,
            redirect_uri=_callback_uri(request, provider),
        )
        response.status_code = 302
        response["Location"] = redirect_url
        return response
    except ValueError as e:
        if e.args[0] in [
            ErrorCode.SSO_SESSION_EXPIRED,
            ErrorCode.EMAIL_ALREADY_EXISTS,
            ErrorCode.SSO_NONCE_MISMATCH,
            ErrorCode.SSO_ACCOUNT_ALREADY_LINKED,
        ]:
            session = await SSOSession.objects.filter(state=state).afirst()
            if session:
                parsed = urlparse(session.redirect_to)
                query_params = parse_qs(parsed.query)
                query_params["error"] = [e.args[0]]
                new_query = urlencode(query_params, doseq=True)

                response.status_code = 302
                response["Location"] = urlunparse((
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    new_query,
                    parsed.fragment,
                ))
                return response
        raise


@router.post("/{provider}/link", response=AuthorizeResponseSchema)
async def link(request: HttpRequest, provider: str, data: AuthorizeSchema):
    return {
        "authorization_url": await SSOSession.authorization_url(
            provider=provider,
            redirect_to=data.redirect_to,
            user_id=request.auth,
            redirect_uri=_callback_uri(request, provider),
        )
    }


@router.get("/account", response=list[SSOAccountSchema])
async def get_accounts(request: HttpRequest):
    return [a async for a in SSOAccount.objects.filter(user_id=request.auth).all()]


@router.delete("/account/{id}")
async def delete_account(request: HttpRequest, id: str):
    deleted, _ = await SSOAccount.objects.filter(user_id=request.auth, id=id).adelete()
    if not deleted:
        raise ValueError(ErrorCode.NOT_FOUND)
