import logging
from datetime import timedelta
from functools import wraps

from celery.exceptions import ImproperlyConfigured
from django.utils import timezone

from apps.common.error import ErrorCode
from apps.common.policy import PlatformRealm
from apps.common.util import AccessDate, HttpRequest, get_realm, openapi_query_param
from apps.content.models import Media, PublicAccessMedia
from apps.course.models import Course
from apps.learning.models import ENROLLABLE_MODEL_MAP, Enrollment
from apps.preview.models import PreviewUser
from apps.quiz.models import Quiz
from apps.tutor.models import TUTORING_MODEL_MAP, Allocation

log = logging.getLogger(__name__)


SPECIAL_ACCESS_TIME = timedelta(hours=1)


def access_date(app_label, model, *, id_field: str = "id"):
    def decorator(func):
        # openapi query param
        openapi_query_param(func=func, name="media", schema_type="string", required=False, nullable=False)

        # currently only quiz is allowed to be inlined
        if app_label == Quiz._meta.app_label and model == Quiz._meta.model_name:
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
                candidate = (course_id, Course._meta.app_label, Course._meta.model_name)
            elif media_id:
                candidate = (media_id, Media._meta.app_label, Media._meta.model_name)
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
            if app_label == Media._meta.app_label and model == Media._meta.model_name:
                public_access = await PublicAccessMedia.get_access_date(media_id=content_id)
            elif media_id:
                public_access = await PublicAccessMedia.get_access_date(media_id=media_id)

            # Check special access
            if not (enrollment or public_access):
                has_special_access = False
                realm = get_realm(request)

                # editor requires ownership
                if realm == PlatformRealm.STUDIO:
                    ContentModel = ENROLLABLE_MODEL_MAP.get((app_label, model))
                    if not ContentModel:
                        raise ValueError(ErrorCode.UNKNOWN_CONTENT)

                    if await ContentModel.objects.filter(id=content_id, owner_id=user_id).aexists():
                        has_special_access = True

                # tutor rquires allocation
                elif realm == PlatformRealm.TUTOR:
                    ContentModel = TUTORING_MODEL_MAP.get((app_label, model))
                    if not ContentModel:
                        raise ValueError(ErrorCode.UNKNOWN_CONTENT)

                    if await Allocation.objects.filter(tutor_id=user_id, active=True, content_id=content_id).aexists():
                        has_special_access = True

                # preview requires preview worker
                elif realm == PlatformRealm.PREVIEW:
                    if await PreviewUser.objects.filter(user_id=user_id).aexists():
                        has_special_access = True

                if has_special_access:
                    # grant temporary access to tutor
                    now = timezone.now()
                    expire = now + SPECIAL_ACCESS_TIME
                    accessible = AccessDate(start=now, end=expire, archive=expire)
                    request.access_date = accessible
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


def _get_favorable_date(a: Enrollment | None, b: PublicAccessMedia | None) -> AccessDate:
    if a and b:
        return AccessDate(start=min(a.start, b.start), end=max(a.end, b.end), archive=max(a.archive, b.archive))
    c = a or b
    if c:
        return AccessDate(start=c.start, end=c.end, archive=c.archive)
    raise ValueError(ErrorCode.ACCESS_DENIED)
