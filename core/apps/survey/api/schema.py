from typing import Annotated

from ninja import Field
from pydantic import RootModel

from apps.account.api.schema import OwnerSchema
from apps.common.schema import LearningObjectMixinSchema, Schema
from apps.survey.models import Question, Survey


class SurveySchema(LearningObjectMixinSchema):
    class SurveyQuestionSchema(Schema):
        id: int
        format: Question.SurveyQuestionFormatChoices
        question: str
        supplement: str
        options: list[str]
        mandatory: bool

        @staticmethod
        def resolve_supplement(obj: Question):
            return obj.cleaned_supplement

    id: str
    thumbnail: str
    owner: OwnerSchema
    complete_message: str
    anonymous: bool
    show_results: bool
    questions: list[SurveyQuestionSchema]

    @staticmethod
    def resolve_questions(obj: Survey):
        return obj.question_pool.questions.all()


class SurveyAnswersSchema(RootModel[dict[str, Annotated[str, Field(min_length=1)]]]):
    pass
