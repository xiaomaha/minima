from apps.common.schema import Schema


class SSOAccountSchema(Schema):
    id: str
    provider: str
    email: str


class AuthorizeSchema(Schema):
    redirect_to: str


class AuthorizeResponseSchema(Schema):
    authorization_url: str
