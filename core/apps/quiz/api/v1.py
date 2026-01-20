from ninja.router import Router

from apps.common.util import HttpRequest
from apps.learning.api.access_control import access_date, active_context
from apps.quiz.api.schema import QuizAttemptAnswersSchema, QuizAttemptSchema, QuizSessionSchema
from apps.quiz.models import Attempt, Quiz

router = Router(by_alias=True)


@router.get("/{id}/session", response=QuizSessionSchema)
@active_context()
@access_date("quiz", "quiz")
async def get_session(request: HttpRequest, id: str):
    return await Quiz.get_session(
        quiz_id=id, learner_id=request.auth, context=request.active_context, access_date=request.access_date
    )


@router.post("/{id}/attempt", response=QuizAttemptSchema)
@active_context()
@access_date("quiz", "quiz")
async def start_attempt(request: HttpRequest, id: str):
    return await Attempt.start(quiz_id=id, learner_id=request.auth, context=request.active_context)


@router.post("/{id}/attempt/submit", response=QuizSessionSchema)
@active_context()
@access_date("quiz", "quiz")
async def submit_attempt(request: HttpRequest, id: str, data: QuizAttemptAnswersSchema):
    return await Attempt.submit(
        quiz_id=id,
        learner_id=request.auth,
        context=request.active_context,
        answers=data.model_dump(),
        access_date=request.access_date,
    )


@router.delete("/{id}/attempt/deactivate")
@active_context()
@access_date("quiz", "quiz")
async def deactivate_attempt(request: HttpRequest, id: str):
    await Attempt.deactivate(quiz_id=id, learner_id=request.auth, context=request.active_context)
