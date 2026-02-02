from itertools import cycle

import mimesis
from django.conf import settings
from factory.declarations import LazyFunction, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.models import User
from apps.common.tests.factories import lazy_avatar
from apps.common.util import tuid
from apps.partner.models import Cohort, CohortMember, CohortStaff, Group, Member, Partner

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class PartnerFactory(DjangoModelFactory[Partner]):
    name = FactoryField("company")
    description = FactoryField("sentence")
    phone = FactoryField("phone_number")
    email = FactoryField("email")
    address = FactoryField("address")
    logo = LazyFunction(lazy_avatar)
    website = FactoryField("url")

    class Meta:
        model = Partner
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: Partner, create: bool, extracted, **kwargs):
        if not create:
            return

        if self.group_set.exists():
            return

        GroupFactory.reset_sequence()
        GroupFactory.create_batch(generic.random.randint(1, 10), partner=self)


class GroupFactory(DjangoModelFactory[Group]):
    partner = SubFactory(PartnerFactory)
    name = FactoryField("word")
    description = FactoryField("text")
    business_number = LazyFunction(lambda: tuid())

    class Meta:
        model = Group
        django_get_or_create = ("partner", "name")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: Group, create: bool, extracted, **kwargs):
        if not create:
            return

        if self.member_set.exists():
            return

        MemberFactory.create_batch(generic.random.randint(5, 10), group=self)


class MemberFactory(DjangoModelFactory[Member]):
    group = SubFactory(GroupFactory)
    name = FactoryField("full_name")
    email = FactoryField("email")
    birth_date = FactoryField("date", start=1950, end=2000)
    encrypted_personal_id = LazyFunction(
        lambda: Member.encrypt_personal_id(f"{generic.person.identifier()}-{generic.cryptographic.uuid()[:8]}")
    )
    phone = FactoryField("phone_number")
    team = FactoryField("fruit")
    job_position = FactoryField("color")
    job_title = FactoryField("occupation")
    employment_status = ""
    employment_type = ""

    class Meta:
        model = Member
        django_get_or_create = ("group", "email")


class CohortFactory(DjangoModelFactory[Cohort]):
    name = FactoryField("color")
    description = FactoryField("text")

    class Meta:
        model = Cohort
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted, **kwargs):
        if not create:
            return

        members = Member.objects.order_by("?")[: generic.random.randint(20, 30)]
        CohortMember.objects.bulk_create(
            [CohortMember(cohort=self, member=member) for member in members], ignore_conflicts=True
        )

        users = User.objects.order_by("?")[: generic.random.randint(1, 3)]
        role_cycle = cycle([choice[0] for choice in CohortStaff.RoleChoices.choices])
        CohortStaff.objects.bulk_create(
            [CohortStaff(cohort=self, staff=user, role=next(role_cycle)) for user in users], ignore_conflicts=True
        )
