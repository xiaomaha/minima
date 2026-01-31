import jwt
from jwt import PyJWKClient

from apps.common.error import ErrorCode
from apps.sso.providers.base import TokenResponse, UserInfo
from apps.sso.providers.oidc import OIDCProvider


class GoogleProvider(OIDCProvider):
    def __init__(self, config):
        super().__init__(config)
        self._jwks_client = None

    async def get_user_info(self, tokens: TokenResponse, nonce: str):
        id_token = tokens.get("id_token")
        if not id_token:
            raise ValueError(ErrorCode.INVALID_SSO_TOKEN)

        metadata = await self._get_metadata()

        if not self._jwks_client:
            self._jwks_client = PyJWKClient(metadata["jwks_uri"])

        signing_key = self._jwks_client.get_signing_key_from_jwt(id_token)

        claims = jwt.decode(
            id_token, signing_key.key, algorithms=["RS256"], audience=self.client_id, issuer=metadata["issuer"]
        )

        if claims.get("nonce") != nonce:
            raise ValueError(ErrorCode.SSO_NONCE_MISMATCH)

        if not claims.get("email_verified"):
            raise ValueError(ErrorCode.SSO_EMAIL_NOT_VERIFIED)

        return UserInfo(provider_user_id=claims["sub"], email=claims["email"], name=claims.get("name", ""))
