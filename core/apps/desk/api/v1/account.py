from datetime import date

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Q, Value
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import Language
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
    avatar: str | None
    phone: str
    birth_date: date | None
    language: Language
    is_active: bool
    is_superuser: bool
    roles: list[str]
    realms: list[str]

    @staticmethod
    def resolve_phone(obj):
        if not obj.phone:
            return ""
        return str(obj.phone)


@router.get("/account/user", response=list[DeskUserSpec])
@paginate(Pagination)
async def get_users(request):
    return User.objects.annotate(
        roles=ArrayAgg("groups__name", filter=Q(groups__isnull=False), default=Value([]), distinct=True),
        realms=ArrayAgg(
            "members__group__partner__realm",
            filter=Q(members__group__partner__realm__isnull=False),
            default=Value([]),
            distinct=True,
        ),
    ).order_by("-created")
