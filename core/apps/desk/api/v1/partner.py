from django.db.models import Q
from ninja import Router
from ninja.pagination import paginate

from apps.common.schema import TimeStampedMixinSchema
from apps.common.util import HttpRequest, Pagination
from apps.partner.models import Partner

router = Router(by_alias=True)


class DeskPartnerSpec(TimeStampedMixinSchema):
    id: int
    name: str
    realm: str
    phone: str
    email: str
    logo: str
    website: str


@router.get("/partner/parnter", response=list[DeskPartnerSpec])
@paginate(Pagination)
async def get_partners(request: HttpRequest, search: str | None = None):
    partners = Partner.objects.order_by("-created")

    if search:
        partners = partners.filter(Q(name__icontains=search) | Q(realm__icontains=search))

    return partners
