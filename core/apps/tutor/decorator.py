from functools import wraps

from asgiref.sync import sync_to_async
from django.contrib.contenttypes.models import ContentType

from apps.common.error import ErrorCode
from apps.common.util import HttpRequest
from apps.tutor.models import Allocation


def tutor_required():
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):
            if "tutor" not in request.roles:
                raise ValueError(ErrorCode.PERMISSION_DENIED)
            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def allocation_required(app_label: str, model: str, id_field: str = "id"):
    def decorator(func):
        @wraps(func)
        async def wrapper(request: HttpRequest, *args, **kwargs):

            content_type = await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, model)
            allocated = await Allocation.objects.filter(
                tutor_id=request.auth, active=True, content_type=content_type, content_id=kwargs[id_field]
            ).aexists()

            if not allocated:
                raise ValueError(ErrorCode.PERMISSION_DENIED)

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator
