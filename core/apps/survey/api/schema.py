from typing import Annotated, Literal

from ninja import Field
from pydantic import RootModel

from apps.account.api.schema import OwnerSchema
from apps.common.schema import LearningObjectMixinSchema, Schema
from apps.survey.models import Survey


class SurveySchema(LearningObjectMixinSchema):
    id: str
    thumbnail: str
    owner: OwnerSchema
    complete_message: str
    anonymous: bool
    show_results: bool
    questions: list[SurveyQuestionSchema]

    @staticmethod
    def resolve_questions(obj: Survey):
        return obj.paper.question_set.all()


class SurveyQuestionSchema(Schema):
    id: int
    format: Literal["single_choice", "text_input", "number_input"]
    question: str
    supplement: str
    options: list[str]
    mandatory: bool


class SurveyAnswersSchema(RootModel[dict[str, Annotated[str, Field(min_length=1)]]]):
    pass
