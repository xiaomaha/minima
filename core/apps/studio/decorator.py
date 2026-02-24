from functools import wraps

from asgiref.sync import sync_to_async
from django.contrib.contenttypes.models import ContentType

from apps.common.error import ErrorCode
from apps.common.util import HttpRequest
from apps.studio.models import Draft


def editor_required():
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            if "editor" not in request.roles:
                raise ValueError(ErrorCode.PERMISSION_DENIED)

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def track_draft(model, *, id_field: str = "id"):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            result = await func(request, *args, **kwargs)
            content_type = await sync_to_async(ContentType.objects.get_for_model)(model)

            await Draft.objects.aupdate_or_create(
                content_type=content_type,
                content_id=kwargs[id_field] if id_field else result,
                defaults={"author_id": request.auth},
            )
            return result

        return wrapper

    return decorator
