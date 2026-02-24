from abc import abstractmethod

import httpx

from apps.sso.providers.base import BaseProvider, ConfigDict, TokenResponse, UserInfo


class OIDCProvider(BaseProvider):
    def __init__(self, config: ConfigDict):
        super().__init__(config)
        self.server_metadata_url = config["server_metadata_url"]
        self._metadata = None

    async def _get_metadata(self):
        if self._metadata:
            return self._metadata

        async with httpx.AsyncClient() as client:
            res = await client.get(self.server_metadata_url)
            res.raise_for_status()

            self._metadata = res.json()
            return self._metadata

    async def get_authorization_url(self, state: str, nonce: str, redirect_uri: str):
        metadata = await self._get_metadata()
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.config.get("scope", "openid email profile"),
            "state": state,
            "nonce": nonce,
        }
        return f"{metadata['authorization_endpoint']}?{httpx.QueryParams(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        metadata = await self._get_metadata()
        async with httpx.AsyncClient() as client:
            res = await client.post(
                metadata["token_endpoint"],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            res.raise_for_status()
            return res.json()

    @abstractmethod
    async def get_user_info(self, tokens: TokenResponse, nonce: str) -> UserInfo:
        pass
