from abc import ABC, abstractmethod
from typing import NotRequired, TypedDict


class UserInfo(TypedDict):
    provider_user_id: str
    email: str
    name: str


class ConfigDict(TypedDict):
    client_id: str
    client_secret: str
    server_metadata_url: NotRequired[str]
    scope: NotRequired[str]


class TokenResponse(TypedDict):
    token_type: str
    access_token: str
    refresh_token: NotRequired[str]
    expires_in: NotRequired[int]
    id_token: NotRequired[str]
    scope: NotRequired[str]


class BaseProvider(ABC):
    def __init__(self, config: ConfigDict):
        self.config = config
        self.client_id = config["client_id"]
        self.client_secret = config["client_secret"]

    @abstractmethod
    async def get_authorization_url(self, state: str, nonce: str, redirect_uri: str):
        pass

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        pass

    @abstractmethod
    async def get_user_info(self, tokens: TokenResponse, nonce: str) -> UserInfo:
        pass
