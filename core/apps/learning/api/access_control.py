import logging
from datetime import timedelta
from functools import wraps
from typing import cast

from celery.exceptions import ImproperlyConfigured
from django.utils import timezone

from apps.common.error import ErrorCode
from apps.common.util import AccessDate, AttemptModeChoices, HttpRequest, openapi_query_param
from apps.content.models import Media, PublicAccessMedia
from apps.course.models import Course
from apps.learning.models import ENROLLABLE_MODEL_MAP, Enrollment
from apps.quiz.models import Quiz

log = logging.getLogger(__name__)


def access_date(app_label, model, *, id_field: str = "id"):
    def decorator(func):
        # openapi query param
        openapi_query_param(func=func, name="media", schema_type="string", required=False, nullable=False)

        # currently only quiz is allowed to be inlined
        if app_label == Quiz._meta.app_label and model == Quiz._meta.model.__name__.lower():
            openapi_query_param(func=func, name="course", schema_type="string", required=False, nullable=False)

        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            user_id = request.auth
            content_id = kwargs.get(id_field)

            if not content_id:
                raise ImproperlyConfigured("id_field is required")

            course_id = request.GET.get("course")
            media_id = request.GET.get("media")

            # step 1: check enrollment

            if course_id:
                candidate = (course_id, Course._meta.app_label, Course._meta.model.__name__.lower())
            elif media_id:
                candidate = (media_id, Media._meta.app_label, Media._meta.model.__name__.lower())
            else:
                candidate = (content_id, app_label, model)

            enrollment = await Enrollment.objects.filter(
                user_id=user_id,
                active=True,
                content_id=candidate[0],
                content_type__app_label=candidate[1],
                content_type__model=candidate[2],
            ).afirst()  # unique

            public_access = None
            if app_label == Media._meta.app_label and model == Media._meta.model.__name__.lower():
                public_access = await PublicAccessMedia.get_access_date(media_id=content_id)
            elif media_id:
                public_access = await PublicAccessMedia.get_access_date(media_id=media_id)

            if not (enrollment or public_access):
                if "editor" in request.roles:
                    ContentModel = ENROLLABLE_MODEL_MAP[(app_label, model)]
                    # Check ownership
                    if await ContentModel.objects.filter(id=content_id, owner_id=user_id).aexists():
                        # grant 1 hour temporary access to editor
                        now = timezone.now()
                        accessible = AccessDate(
                            start=now, end=now + timedelta(hours=1), archive=now + timedelta(hours=1)
                        )
                        request.access_date = accessible
                        request.active_context = ""
                        return await func(request, *args, **kwargs)

            # more favorable access date between enrollment and public access
            accessible = _get_favorable_date(enrollment, public_access)

            # step 2: override accessible date by context

            if course_id:
                # When content is accessed within a course context, we need to determine
                # which content to use for permission checking with the course.
                # If media_id is present (e.g., quiz accessed via media), we check course
                # permissions against the media (parent) rather than the quiz (child),
                # since courses contain media, not individual quizzes directly.

                effective_content = (content_id, app_label, model)
                if media_id:
                    effective_content = (media_id, Media._meta.app_label, Media._meta.model.__name__.lower())

                try:
                    accessible = await Course.content_effective_date(
                        course_id=course_id,
                        content_id=effective_content[0],
                        app_label=effective_content[1],
                        model=effective_content[2],
                        access_date=accessible,
                    )
                except ValueError as e:
                    log.error(e, exc_info=True)
                    raise ValueError(ErrorCode.ACCESS_DENIED)

            elif media_id:
                # access date is equal to media
                try:
                    await Media.content_inline_access(
                        media_id=media_id, content_id=content_id, app_label=app_label, model=model
                    )
                except ValueError as e:
                    log.error(e, exc_info=True)
                    raise ValueError(ErrorCode.ACCESS_DENIED)

            # step 3: check access date

            now = timezone.now()

            if now < accessible["start"]:
                raise ValueError(ErrorCode.CONTENT_NOT_AVAILABLE)

            if now >= accessible["archive"]:
                raise ValueError(ErrorCode.REVIEW_PERIOD_OVER)

            if accessible["end"] <= now < accessible["archive"]:
                if request.method not in ["GET", "HEAD", "OPTIONS"]:
                    raise ValueError(ErrorCode.CONTENT_READ_ONLY)

            # pass access date
            request.access_date = accessible
            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def active_context():
    def decorator(func):
        openapi_query_param(func=func, name="course", schema_type="string", required=False, nullable=False)

        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            user_id = request.auth
            course_id = request.GET.get("course")

            # With active unique pattern, active context is unique but multiple contexts can exist.
            # Frontend only accesses active context, so no need to distinguish between context and active context
            # When frontend sends current context, server must fetch and save active context value for snapshot
            # Here we convert current context to active context

            active_context = ""  # default: standalone
            if course_id:
                active_context = await Course.issue_context(course_id=course_id, user_id=user_id)

            request.active_context = active_context
            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def access_mode():
    def decorator(func):
        openapi_query_param(func=func, name="mode", schema_type="string", required=False, nullable=False)

        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            mode = request.GET.get("mode", AttemptModeChoices.NORMAL)
            if mode not in AttemptModeChoices:
                raise ValueError(ErrorCode.INVALID_ACCESS_MODE)

            request.access_mode = cast(AttemptModeChoices, mode)

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def _get_favorable_date(a: Enrollment | None, b: PublicAccessMedia | None) -> AccessDate:
    if a and b:
        return AccessDate(start=min(a.start, b.start), end=max(a.end, b.end), archive=max(a.archive, b.archive))
    c = a or b
    if c:
        return AccessDate(start=c.start, end=c.end, archive=c.archive)
    raise ValueError(ErrorCode.ACCESS_DENIED)
