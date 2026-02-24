from typing import Annotated, Literal

from ninja import Router
from ninja.params import functions

from apps.assignment.models import Assignment
from apps.content.models import Media
from apps.course.models import Course
from apps.discussion.models import Discussion
from apps.exam.models import Exam
from apps.quiz.models import Quiz
from apps.studio.api.v1.assignment import router as assignment_router
from apps.studio.api.v1.discussion import router as discussion_router
from apps.studio.api.v1.exam import router as exam_router
from apps.studio.api.v1.media import router as media_router
from apps.studio.api.v1.quiz import router as quiz_router
from apps.studio.api.v1.schema import ContentSuggestionSpec
from apps.studio.api.v1.survey import router as survey_router
from apps.studio.decorator import editor_required
from apps.survey.models import Survey

router = Router(by_alias=True)


STUDIO_MODDELS = {
    "exam": Exam,
    "survey": Survey,
    "quiz": Quiz,
    "assignment": Assignment,
    "discussion": Discussion,
    "media": Media,
    "course": Course,
}

MAX_SUGGESTIONS = 1000


@router.get("/suggestion/content", response=list[ContentSuggestionSpec])
@editor_required()
async def content_suggestions(
    request,
    kind: Annotated[
        Literal["exam", "survey", "quiz", "assignment", "discussion", "media", "course"], functions.Query(...)
    ],
):
    return [
        raw
        async for raw in STUDIO_MODDELS[kind]
        .objects.filter(owner_id=request.auth)
        .values("title", "id", "modified")
        .order_by("-modified")[:MAX_SUGGESTIONS]
    ]


router.add_router("", exam_router, tags=["studio"])
router.add_router("", quiz_router, tags=["studio"])
router.add_router("", survey_router, tags=["studio"])
router.add_router("", discussion_router, tags=["studio"])
router.add_router("", assignment_router, tags=["studio"])
router.add_router("", media_router, tags=["studio"])
