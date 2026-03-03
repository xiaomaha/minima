from datetime import date

from apps.account.api.schema import OwnerSchema
from apps.common.schema import Schema
from apps.partner.models import Cohort, CohortStaff, Member


class PartnerSchema(Schema):
    name: str
    logo: str
    website: str


class PartnerGroupSchema(Schema):
    name: str
    description: str
    partner: PartnerSchema


class PartnerGroupMemberSchema(Schema):
    name: str
    email: str
    birth_date: date
    phone: str
    team: str
    job_position: str
    job_title: str
    employment_status: str
    employment_type: str
    group: PartnerGroupSchema
    cohorts: list[CohortSchema]
    member_count: int

    @staticmethod
    def resolve_phone(obj):
        if not obj.phone:
            return ""
        return str(obj.phone)

    @staticmethod
    def resolve_cohorts(obj: Member):
        cohorts = []
        for c in obj.cohort_members.all():
            c.cohort.member_count = c.member_count
            cohorts.append(c.cohort)
        return cohorts


class CohortSchema(Schema):
    name: str
    description: str
    staffs: list[CohortStaffSchema]
    member_count: int

    @staticmethod
    def resolve_staffs(obj: Cohort):
        return obj.cohort_staffs.all()


class CohortStaffSchema(Schema):
    role: CohortStaff.RoleChoices
    staff: OwnerSchema
