from datetime import datetime
from typing import Literal

from pydantic.root_model import RootModel

from apps.account.api.schema import OwnerSchema
from apps.common.schema import ContentTypeSchema, LearningObjectMixinSchema, Schema, TimeStampedMixinSchema
from apps.learning.models import CatalogItem, Enrollment


class EnrollmentSchema(TimeStampedMixinSchema):
    class EnrollmentContentSchema(LearningObjectMixinSchema):
        id: str
        owner: OwnerSchema

    id: int
    content: EnrollmentContentSchema
    content_type: ContentTypeSchema
    active: bool
    start: datetime
    end: datetime
    archive: datetime
    enrolled: datetime
    can_deactivate: bool

    @staticmethod
    def resolve_content(enrollment: Enrollment):
        return enrollment._content_cache


class LearningRecordSchema(RootModel[dict[str, dict[str, float]]]):
    pass


class CatalogSchema(TimeStampedMixinSchema):
    id: int
    name: str
    description: str
    active: bool
    public: bool
    available_from: datetime
    available_until: datetime
    item_count: int
    provider: Literal["public", "personal", "cohort"]
    cohort_name: str | None


class CatalogItemSchema(TimeStampedMixinSchema):
    class CatalogContentSchema(LearningObjectMixinSchema):
        id: str
        owner: OwnerSchema

    id: int
    content: CatalogContentSchema
    content_type: ContentTypeSchema
    enrolled: bool

    @staticmethod
    def resolve_content(item: CatalogItem):
        return item._content_cache


class CatalogItemEnrollSchema(Schema):
    app_label: str
    model: str
    content_id: str


class EnrollmentSuccessSchema(TimeStampedMixinSchema):
    id: int
    active: bool
    start: datetime
    end: datetime
    archive: datetime
    enrolled: datetime
    can_deactivate: bool


class UnEnrollSchema(Schema):
    enrollment_id: int


class LearningReportSchema(Schema):
    enrollment_count: int
    exam_attempt_count: int
    discussion_attempt_count: int
    assignment_attempt_count: int
    quiz_attempt_count: int
    survey_submission_count: int
    watch_media_count: int
    watch_seconds: int
