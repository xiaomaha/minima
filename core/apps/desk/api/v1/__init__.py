from ninja import Router

from apps.desk.api.v1.account import router as account_router
from apps.desk.api.v1.learning import router as learning_router
from apps.desk.api.v1.operation import router as operation_router
from apps.desk.api.v1.partner import router as partner_router


def desk_auth(request):
    return request.auth if "desk" in request.roles else ""


router = Router(by_alias=True, auth=desk_auth)


router.add_router("", account_router, tags=["desk"])
router.add_router("", learning_router, tags=["desk"])
router.add_router("", partner_router, tags=["desk"])
router.add_router("", operation_router, tags=["desk"])
