from typing import Annotated

from pydantic.fields import Field
from pydantic.root_model import RootModel

from apps.account.api.schema import OwnerSchema
from apps.common.schema import (
    AccessDateSchema,
    AttemptMixinSchema,
    GradeFieldMixinSchema,
    LearningObjectMixinSchema,
    Schema,
    ScoreStatsSchema,
    TimeStampedMixinSchema,
)
from apps.common.util import LearningSessionStep
from apps.quiz.models import Question, Quiz


class QuizSchema(LearningObjectMixinSchema):
    id: str
    owner: OwnerSchema
    question_count: int

    @staticmethod
    def resolve_question_count(obj: Quiz):
        return obj.question_pool.select_count


class QuizSubmissionSchema(TimeStampedMixinSchema):
    id: int
    answers: dict[str, str]


class QuizQuestionSchema(Schema):
    id: int
    options: list[str]
    question: str
    supplement: str
    point: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


class QuizAttemptSchema(AttemptMixinSchema):
    id: int
    questions: list[QuizQuestionSchema]
    retry: int


class QuizGradeSchema(GradeFieldMixinSchema, TimeStampedMixinSchema):
    id: int
    earned_details: dict[str, int | None]
    feedback: dict[str, str]


class QuizSolutionSchema(Schema):
    id: int
    correct_answers: list[str]
    explanation: str


class QuizSessionSchema(Schema):
    access_date: AccessDateSchema
    step: LearningSessionStep
    quiz: QuizSchema
    attempt: Annotated[QuizAttemptSchema, Field(None)]
    submission: Annotated[QuizSubmissionSchema, Field(None)]
    grade: Annotated[QuizGradeSchema, Field(None)]
    solutions: Annotated[dict[str, QuizSolutionSchema], Field(None)]
    analysis: Annotated[dict[str, dict[str, int]], Field(None)]
    stats: Annotated[ScoreStatsSchema, Field(None)]


class QuizAttemptAnswersSchema(RootModel[dict[str, Annotated[str, Field(min_length=1)]]]):
    pass
