from typing import Annotated

from django.conf import settings
from ninja.files import UploadedFile
from ninja.params import Form, functions
from ninja.router import Router

from apps.assignment.api.schema import (
    AssignmentAttemptSchema,
    AssignmentSessionSchema,
    AssignmentSubmissionSchema,
    AssignmentSubmitSchema,
)
from apps.assignment.models import Assignment, Attempt
from apps.common.schema import FileSizeValidator, FileTypeValidator
from apps.common.util import HttpRequest
from apps.learning.api.access_control import access_date, access_realm, active_context

router = Router(by_alias=True)


@router.get("/{id}/session", response=AssignmentSessionSchema)
@active_context()
@access_date("assignment", "assignment")
async def get_session(request: HttpRequest, id: str):
    return await Assignment.get_session(
        assignment_id=id, learner_id=request.auth, context=request.active_context, access_date=request.access_date
    )


@router.post("/{id}/attempt", response=AssignmentAttemptSchema)
@active_context()
@access_realm()
@access_date("assignment", "assignment")
async def start_attempt(request: HttpRequest, id: str):
    return await Attempt.start(
        assignment_id=id,
        learner_id=request.auth,
        lock=request.access_date["end"],
        context=request.active_context,
        realm=request.access_realm,
    )


@router.post("/{id}/attempt/submit", response=AssignmentSubmissionSchema)
@active_context()
@access_date("assignment", "assignment")
async def submit_attempt(
    request: HttpRequest,
    id: str,
    data: Form[AssignmentSubmitSchema],
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    return await Attempt.submit(
        assignment_id=id, learner_id=request.auth, context=request.active_context, answer=data.answer, files=files
    )


@router.delete("/{id}/attempt/deactivate")
@active_context()
@access_date("assignment", "assignment")
async def deactivate_attempt(request: HttpRequest, id: str):
    await Attempt.deactivate(assignment_id=id, learner_id=request.auth, context=request.active_context)
