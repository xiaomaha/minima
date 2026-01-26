from ninja.router import Router

from apps.partner.api.schema import PartnerGroupMemberSchema
from apps.partner.models import Member

router = Router(by_alias=True)


@router.get("/member/information", response=list[PartnerGroupMemberSchema])
async def member_infos(request):
    return await Member.member_infos(user_id=request.auth)
