from datetime import date, datetime

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import Max, Q, Value
from ninja import Router
from ninja.pagination import paginate

from apps.account.api.schema import Language
from apps.account.models import User
from apps.common.schema import PGHContextSchema, Schema, TimeStampedMixinSchema
from apps.common.util import HttpRequest, Pagination

router = Router(by_alias=True)


class DeskUserSpec(TimeStampedMixinSchema):
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
    roles: list[str]
    realms: list[str]
    last_login: datetime | None

    @staticmethod
    def resolve_phone(obj):
        if not obj.phone:
            return ""
        return str(obj.phone)


@router.get("/account/user", response=list[DeskUserSpec])
@paginate(Pagination)
async def get_users(request: HttpRequest, search: str | None = None):
    users = User.objects.annotate(
        roles=ArrayAgg("groups__name", filter=Q(groups__isnull=False), default=Value([]), distinct=True),
        realms=ArrayAgg(
            "members__group__partner__realm",
            filter=Q(members__group__partner__realm__isnull=False),
            default=Value([]),
            distinct=True,
        ),
        last_login=Max("token__modified"),
    ).order_by("-created")

    if search:
        users = users.filter(
            Q(email__icontains=search)
            | Q(name__icontains=search)
            | Q(nickname__icontains=search)
            | Q(groups__name__icontains=search)
            | Q(members__group__partner__realm__icontains=search)
        ).distinct()

    return users


class DeskUserDetailSpec(Schema):
    class DeskUserDetailHistorySpec(Schema):
        pgh_created_at: datetime
        pgh_context: PGHContextSchema | None
        id: str
        email: str
        name: str
        phone: str
        birth_date: date | None

    histories: list[DeskUserDetailHistorySpec]


@router.get("/account/user/{id}", response=DeskUserDetailSpec)
async def get_user_detail(request: HttpRequest, id: str):
    return {
        "histories": [
            h
            async for h in User.pgh_event_model.objects
            .select_related("pgh_context")
            .filter(Q(pgh_obj_id=id) & ~Q(pgh_label="insert"))
            .order_by("-pgh_created_at")[:10]
        ]
    }
