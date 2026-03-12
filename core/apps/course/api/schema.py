from datetime import datetime
from typing import Annotated, Literal

from pydantic.fields import Field

from apps.account.api.schema import OwnerSchema
from apps.common.schema import (
    AccessDateSchema,
    AttemptMixinSchema,
    GradingDateSchema,
    LearningObjectMixinSchema,
    Schema,
    TimeStampedMixinSchema,
)
from apps.competency.api.schema import CertificateAwardSchema
from apps.course.models import Course
from apps.operation.api.schema import FAQSchema, HonorCodeSchema
from apps.partner.api.schema import PartnerSchema


class CourseDetailSchema(LearningObjectMixinSchema):
    class CourseCategorySchema(Schema):
        id: int
        label: str

    class CourseCertificateSchema(Schema):
        class CourseCertificateItemSchema(Schema):
            id: int
            thumbnail: str
            description: str
            issuer: PartnerSchema

        id: int
        label: str
        certificate: CourseCertificateItemSchema

    class CourseInstructorSchema(Schema):
        class CourseInstructorItemSchema(Schema):
            email: str
            about: str
            bio: list[str]
            avatar: str

        id: int
        label: str
        lead: bool
        instructor: CourseInstructorItemSchema

    class CourseRelationSchema(Schema):
        class CourseRelationItemSchema(Schema):
            id: str
            description: str
            thumbnail: str | None

        id: int
        label: str
        related_course: CourseRelationItemSchema

    id: str
    owner: OwnerSchema
    objective: str
    preview_url: str | None
    effort_hours: int
    level: Course.LevelChoices

    faq: FAQSchema
    course_categories: list[CourseCategorySchema]
    course_certificates: list[CourseCertificateSchema]
    course_instructors: list[CourseInstructorSchema]
    course_relations: list[CourseRelationSchema]


class CourseEngagementSchema(AttemptMixinSchema):
    class CourseGradebookSchema(TimeStampedMixinSchema):
        id: int
        details: dict[str, dict[str, bool | float | int] | None]
        score: float
        completion_rate: float
        passed: bool
        certificate_eligible: bool

    id: int
    gradebook: Annotated[CourseGradebookSchema, Field(None)]


class CourseSchema(LearningObjectMixinSchema):
    class LessonSchema(Schema):
        class LessonMediaSchema(Schema):
            class LessonMediaItemSchema(Schema):
                id: str
                thumbnail: str | None
                format: str

            media: LessonMediaItemSchema

        id: int
        label: str
        start_date: datetime
        end_date: datetime
        lesson_medias: list[LessonMediaSchema]

    class CourseSurveySchema(Schema):
        class CourseSurveyItemSchema(Schema):
            id: str
            thumbnail: str | None

        id: int
        label: str
        start_date: datetime
        end_date: datetime
        survey: CourseSurveyItemSchema

    class GradingCriterionSchema(Schema):
        label: str
        app_label: Literal["completion", "exam", "assignment", "discussion"]
        model: Literal["completion", "exam", "assignment", "discussion"]
        passing_point: int
        weight: float
        normalized_weight: float
        item_id: str
        start_date: datetime | None
        end_date: datetime | None

    id: str
    objective: str
    preview_url: str | None
    effort_hours: int
    level: Course.LevelChoices
    honor_code: HonorCodeSchema
    grading_criteria: list[GradingCriterionSchema]
    lessons: list[LessonSchema]
    course_surveys: list[CourseSurveySchema]


class CourseSessionSchema(Schema):
    access_date: AccessDateSchema
    grading_date: GradingDateSchema
    course: CourseSchema
    engagement: Annotated[CourseEngagementSchema, Field(None)]
    otp_token: Annotated[str, Field(None)]
    certificate_awards: Annotated[list[CertificateAwardSchema], Field(None)]


class CourseCertificateRequestSchema(Schema):
    certificate_id: int
