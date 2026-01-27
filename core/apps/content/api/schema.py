from datetime import datetime
from typing import Annotated

from pydantic.fields import Field

from apps.account.api.schema import OwnerSchema
from apps.common.schema import LearningObjectMixinSchema, Schema, TimeStampedMixinSchema
from apps.content.api.encoder import GzipInEncodedType, GzipOutEncodedType
from apps.content.models import Media, Note, Watch


class MediaSchema(LearningObjectMixinSchema):
    class QuizSchema(Schema):
        id: str
        title: str
        description: str
        question_count: int
        passing_point: int

    id: str
    thumbnail: str
    duration_seconds: float
    license: str
    channel: str
    owner: OwnerSchema
    subtitle_count: int
    format: Media.MediaFormatChoices
    uploaded: bool
    url: str
    quizzes: list[QuizSchema]
    open: datetime


class SubtitleSchema(Schema):
    id: int
    lang: str
    body: str


class WatchedMediaSchema(Schema):
    media_id: str
    title: str
    thumbnail: str
    format: Media.MediaFormatChoices
    duration_seconds: float
    passing_point: int
    url: str
    context: str
    watched: datetime

    @staticmethod
    def resolve_duration_seconds(obj: Watch):
        return obj.duration.total_seconds()

    @staticmethod
    def resolve_context(obj: Watch):
        return obj.normalized_context

    @staticmethod
    def resolve_watched(obj: Watch):
        return obj.modified

    @staticmethod
    def resolve_thumbnail(obj: Watch):
        return Media(thumbnail=obj.thumbnail).thumbnail


class WatchOutSchema(Schema):
    last_position: float
    watch_bits: Annotated[GzipOutEncodedType | None, Field(None, description="Gzip compressed Bit String")]


class WatchInSchema(Schema):
    last_position: float
    watch_bits: Annotated[GzipInEncodedType, Field(None, description="Gzip compressed Bit String")]


class NoteSchema(TimeStampedMixinSchema):
    id: int
    note: str

    @staticmethod
    def resolve_note(obj: Note):
        return obj.cleaned_note


class NoteSaveSchema(Schema):
    note: Annotated[str, Field(..., max_length=10000)]


class SearchedMediaSchema(LearningObjectMixinSchema):
    class MatchedLineSchema(Schema):
        start: str
        line: str

    id: str
    thumbnail: str
    duration_seconds: float
    owner: OwnerSchema
    format: Media.MediaFormatChoices
    uploaded: bool
    url: str

    accessible: bool
    matched_lines: list[MatchedLineSchema] | None
