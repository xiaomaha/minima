from ninja import Router
from ninja.pagination import paginate

from apps.account.models import User
from apps.common.schema import Schema
from apps.common.util import Pagination

router = Router(by_alias=True)


class DeskUserSpec(Schema):
    id: str
    email: str
    name: str
    avatar: str | None
    nickname: str
    phone: str
    brith_date: str
    language: str
    is_active: bool
    is_superuser: bool


@router.get("/account/user", response=list[DeskUserSpec])
@paginate(Pagination)
async def get_users(request):
    return User.objects.order_by("-created")
