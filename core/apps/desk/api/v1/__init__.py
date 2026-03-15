from ninja import Router

from .account import router as account_router

router = Router(by_alias=True)


router.add_router("", account_router, tags=["desk"])
