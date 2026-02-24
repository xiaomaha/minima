from datetime import datetime

from apps.common.schema import Schema


class OwnerSpec(Schema):
    email: str
    name: str


class HonorCodeSpec(Schema):
    title: str
    code: str


class ContentSuggestionSpec(Schema):
    id: str
    title: str
    modified: datetime
