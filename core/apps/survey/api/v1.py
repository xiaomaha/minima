from ninja.router import Router

from apps.common.util import HttpRequest
from apps.learning.api.access_control import access_date, active_context
from apps.survey.api.schema import SurveyAnswersSchema, SurveySchema
from apps.survey.models import Submission, Survey

router = Router(by_alias=True)


@router.get("/{id}", response=SurveySchema)
@access_date("survey", "survey")
async def get_survey(request: HttpRequest, id: str):
    return await Survey.get_survey(id=id)


@router.post("/{id}/submit")
@active_context()
@access_date("survey", "survey")
async def submit(request: HttpRequest, id: str, data: SurveyAnswersSchema):
    await Submission.submit(
        survey_id=id, respondent_id=request.auth, context=request.active_context, answers=data.model_dump()
    )


@router.get("/{id}/results", response=dict[str, dict[str, int]])
@access_date("survey", "survey")
async def results(request: HttpRequest, id: str):
    return await Survey.analyze_answers(id=id)


@router.get("/{id}/anonymous", response=SurveySchema, auth=None)
async def get_anonymous_survey(request: HttpRequest, id: str):
    return await Survey.get_survey(id=id, anonymous=True)


@router.post("/{id}/anonymous/submit", auth=None)
async def submit_anonymous(request: HttpRequest, id: str, data: SurveyAnswersSchema):
    await Submission.submit(survey_id=id, answers=data.model_dump(), anonymous=True)


@router.get("/{id}/anonymous/results", auth=None, response=dict[str, dict[str, int]])
async def results_anonymous(request: HttpRequest, id: str):
    return await Survey.analyze_answers(id=id, anonymous=True)
