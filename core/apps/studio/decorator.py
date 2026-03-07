from functools import wraps

from asgiref.sync import sync_to_async
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

from apps.common.error import ErrorCode
from apps.common.util import HttpRequest
from apps.studio.models import Editing


def editor_required():
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            if "editor" not in request.roles:
                raise ValueError(ErrorCode.PERMISSION_DENIED)

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def track_editing(model, *, id_field: str | None = None):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            result = await func(request, *args, **kwargs)
            content_type = await sync_to_async(ContentType.objects.get_for_model)(model)

            if not id_field and (type(result) not in (int, str)):
                raise ImproperlyConfigured

            await Editing.objects.aupdate_or_create(
                author_id=request.auth,
                content_type=content_type,
                content_id=kwargs[id_field] if id_field else result,
                defaults={"edited": timezone.now(), "detail": func.__name__},
            )

            return result

        return wrapper

    return decorator
