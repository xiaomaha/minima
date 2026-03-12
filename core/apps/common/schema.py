from datetime import datetime

from django.conf import settings
from ninja import Schema as BaseSchema
from ninja.files import UploadedFile
from PIL import Image
from pydantic import GetCoreSchemaHandler
from pydantic.alias_generators import to_camel
from pydantic.config import ConfigDict
from pydantic_core import core_schema

from apps.common.error import ErrorCode


class Schema(BaseSchema):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# https://github.com/vitalik/django-ninja/issues/347
# django-ninja ModelSchema does not working with inheritance!!!


class ContentTypeSchema(Schema):
    app_label: str
    model: str


class TimeStampedMixinSchema(Schema):
    created: datetime
    modified: datetime


class LearningObjectMixinSchema(TimeStampedMixinSchema):
    title: str
    description: str
    audience: str
    thumbnail: str | None
    featured: bool
    format: str
    duration_seconds: float | None
    passing_point: int
    max_attempts: int
    verification_required: bool
    published: datetime | None


class AttemptMixinSchema(Schema):
    started: datetime
    active: bool
    context: str


class GradeWorkflowMixinSchema(Schema):
    grade_due_days: int
    appeal_deadline_days: int
    confirm_due_days: int


class GradeFieldMixinSchema(Schema):
    earned_details: dict[str, int | None]
    possible_point: int
    earned_point: int
    score: float
    passed: bool
    feedback: dict[str, str]
    completed: datetime | None
    confirmed: datetime | None


class GradingDateSchema(Schema):
    grade_due: datetime
    appeal_deadline: datetime
    confirm_due: datetime


class AccessDateSchema(Schema):
    start: datetime
    end: datetime
    archive: datetime


class ScoreStatsSchema(Schema):
    total: int
    avg_score: float
    min_score: float
    max_score: float
    max_count: int
    distribution: list[tuple[int, int]]


class FileSizeValidator:
    def __init__(self, *, max_size_mb: int | None = None):
        if max_size_mb is None:
            max_size_mb = settings.ATTACHMENT_MAX_SIZE_MB
        self.max_size_mb = max_size_mb

    def validate(self, file: UploadedFile) -> UploadedFile:
        if file.size is None:
            raise ValueError(ErrorCode.INVALID_FILE_SIZE)
        if file.size > self.max_size_mb * 1024 * 1024:
            raise ValueError(ErrorCode.FILE_TOO_LARGE)
        return file

    def __get_pydantic_core_schema__(self, source, handler: GetCoreSchemaHandler):
        return core_schema.no_info_after_validator_function(self.validate, handler(source))


class FileTypeValidator:
    def __init__(self, *, allowed_types: list[str] | None = None):
        if not allowed_types:
            allowed_types = settings.ATTACHMENT_ALLOWED_TYPES
        self.allowed_types = allowed_types

    def validate(self, file: UploadedFile) -> UploadedFile:
        if not file.content_type or file.content_type not in self.allowed_types:
            raise ValueError(ErrorCode.INVALID_FILE_TYPE)
        return file

    def __get_pydantic_core_schema__(self, source, handler: GetCoreSchemaHandler):
        return core_schema.no_info_after_validator_function(self.validate, handler(source))


class ImageValidator:
    def validate(self, file: UploadedFile) -> UploadedFile:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise ValueError(ErrorCode.INVALID_FILE_TYPE)
        try:
            img = Image.open(file)
            img.verify()
        except Exception:
            raise ValueError(ErrorCode.INVALID_FILE_TYPE)
        file.seek(0)
        return file

    def __get_pydantic_core_schema__(self, source, handler: GetCoreSchemaHandler):
        return core_schema.no_info_after_validator_function(self.validate, handler(source))
