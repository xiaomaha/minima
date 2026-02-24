from datetime import datetime
from typing import Annotated

from pydantic.fields import Field

from apps.account.api.schema import OwnerSchema
from apps.common.schema import (
    AccessDateSchema,
    GradeFieldMixinSchema,
    GradingDateSchema,
    LearningObjectMixinSchema,
    Schema,
    ScoreStatsSchema,
    TimeStampedMixinSchema,
)
from apps.common.util import LearningSessionStep
from apps.discussion.models import Post, Question
from apps.operation.api.schema import AppealSchema, HonorCodeSchema


class DiscussionSchema(LearningObjectMixinSchema):
    id: str
    owner: OwnerSchema
    honor_code: HonorCodeSchema


class DiscussionQuestionSchema(Schema):
    class DiscussionPointRequirementsSchema(Schema):
        post: Annotated[int, Field(None)]
        reply: Annotated[int, Field(None)]
        tutor_assessment: Annotated[int, Field(None)]
        post_min_characters: Annotated[int, Field(None)]
        reply_min_characters: Annotated[int, Field(None)]

    id: int
    directive: str
    supplement: str
    post_point: int
    reply_point: int
    tutor_assessment_point: int
    post_min_characters: int
    reply_min_characters: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


class DiscussionAttemptSchema(Schema):
    id: int
    question: DiscussionQuestionSchema
    started: datetime
    active: bool
    retry: int


class DiscussionEarnedDetailsSchema(Schema):
    post: int
    reply: int
    tutor_assessment: int


class DiscussionGradeSchema(GradeFieldMixinSchema, TimeStampedMixinSchema):
    class DiscussionFeedbackSchema(Schema):
        tutor_assessment: str

    id: int
    # override
    earned_details: DiscussionEarnedDetailsSchema
    feedback: DiscussionFeedbackSchema


class DiscussionSessionSchema(Schema):
    access_date: AccessDateSchema
    grading_date: GradingDateSchema
    step: LearningSessionStep
    discussion: DiscussionSchema
    attempt: Annotated[DiscussionAttemptSchema, Field(None)]
    post_count: Annotated[DiscussionPostCountSchema, Field(None)]
    grade: Annotated[DiscussionGradeSchema, Field(None)]
    appeal: Annotated[AppealSchema, Field(None)]
    stats: Annotated[ScoreStatsSchema, Field(None)]
    otp_token: Annotated[str, Field(None)]


class DiscussionPostSchema(TimeStampedMixinSchema):
    id: int
    learner: OwnerSchema
    title: str
    body: str

    @staticmethod
    def resolve_learner(obj: Post):
        return obj.attempt.learner

    @staticmethod
    def resolve_body(obj: Post):
        return obj.cleaned_body


class DiscussionOwnPostSchema(TimeStampedMixinSchema):
    id: int
    title: str
    body: str
    parent_id: int | None

    @staticmethod
    def resolve_body(obj: Post):
        return obj.cleaned_body


class DiscussionPostCountSchema(Schema):
    post: int
    reply: int
    valid_post: int
    valid_reply: int


class DiscussionPostWithCountSchema(DiscussionPostSchema):
    post_count: DiscussionPostCountSchema


class DiscussionPostNestedSchema(DiscussionPostSchema):
    children: list[DiscussionPostSchema]


class DiscussionPostSaveSchema(Schema):
    parent_id: Annotated[int, Field(None)]
    title: Annotated[str, Field(min_length=10, max_length=100)]
    body: Annotated[str, Field(max_length=5000)]  # Min is limited by qeustion
