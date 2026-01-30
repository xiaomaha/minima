import httpx

from apps.common.error import ErrorCode
from apps.sso.providers.base import BaseProvider, TokenResponse, UserInfo


class GitHubProvider(BaseProvider):
    async def get_authorization_url(self, state: str, nonce: str, redirect_uri: str):
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": self.config.get("scope", "read:user user:email"),
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{httpx.QueryParams(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            res.raise_for_status()
            return res.json()

    async def get_user_info(self, tokens: TokenResponse, nonce: str) -> UserInfo:
        access_token = tokens.get("access_token")

        if not access_token:
            raise ValueError(ErrorCode.INVALID_SSO_TOKEN)

        async with httpx.AsyncClient() as client:
            user_res = await client.get(
                "https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"}
            )
            user_res.raise_for_status()
            user_data = user_res.json()

            email_res = await client.get(
                "https://api.github.com/user/emails", headers={"Authorization": f"Bearer {access_token}"}
            )
            email_res.raise_for_status()
            emails = email_res.json()

            primary_email = next((e for e in emails if e["primary"] and e["verified"]), None)
            if not primary_email:
                raise ValueError(ErrorCode.SSO_EMAIL_NOT_VERIFIED)

            return UserInfo(
                provider_user_id=str(user_data["id"]),
                email=primary_email["email"],
                name=user_data.get("name") or user_data.get("login", ""),
            )
