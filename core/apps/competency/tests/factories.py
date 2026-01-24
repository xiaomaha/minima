import mimesis
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from factory.declarations import Iterator, LazyAttribute, LazyFunction, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.common.tests.factories import lazy_thumbnail
from apps.competency.certificate import default_certificate_template
from apps.competency.models import (
    Badge,
    BadgeAward,
    BadgeEndorsement,
    BadgeSkill,
    Certificate,
    CertificateEndorsement,
    CertificateSkill,
    Classification,
    CompetencyGoal,
    Factor,
    Skill,
)
from apps.partner.tests.factories import PartnerFactory

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class BadgeFactory(DjangoModelFactory[Badge]):
    name = LazyFunction(lambda: " ".join(generic.text.words(generic.random.randint(3, 5))))
    description = FactoryField("sentence")
    image = LazyFunction(lazy_thumbnail)
    active = True
    issuer = SubFactory(PartnerFactory)

    class Meta:
        model = Badge
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        BadgeSkillFactory.create_batch(generic.random.randint(1, 3), badge=self)
        BadgeEndorsementFactory.create_batch(generic.random.randint(1, 2), badge=self)
        BadgeAwardFactory.create_batch(generic.random.randint(10, 20), badge=self)


class BadgeSkillFactory(DjangoModelFactory[BadgeSkill]):
    badge = SubFactory(BadgeFactory)
    skill = Iterator(Skill.objects.all())
    coverage = 0.0

    class Meta:
        model = BadgeSkill
        django_get_or_create = ("badge", "skill")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: BadgeSkill, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        factors = Factor.objects.filter(skill=self.skill)
        badge_factors = factors[: generic.random.randint(1, len(factors))]
        self.coverage = len(badge_factors) / len(factors) * 100
        self.save()

        self.factors.set(badge_factors)


class BadgeEndorsementFactory(DjangoModelFactory[BadgeEndorsement]):
    badge = SubFactory(BadgeFactory)
    partner = SubFactory(PartnerFactory)
    claim = FactoryField("sentence")
    endorsed = LazyFunction(lambda: timezone.now())

    class Meta:
        model = BadgeEndorsement
        django_get_or_create = ("badge", "partner")


class BadgeAwardFactory(DjangoModelFactory[BadgeAward]):
    badge = SubFactory(BadgeFactory)
    earner = SubFactory(UserFactory)

    class Meta:
        model = BadgeAward
        django_get_or_create = ("badge", "earner")


class CertificateFactory(DjangoModelFactory[Certificate]):
    name = LazyFunction(lambda: " ".join(generic.text.words(generic.random.randint(3, 5))))
    description = FactoryField("sentence")
    background_image = LazyAttribute(
        lambda o: ContentFile(generic.binaryfile.image(file_type=mimesis.ImageFile.PNG), f"{o.name}.png")
    )
    thumbnail = LazyAttribute(
        lambda o: ContentFile(generic.binaryfile.image(file_type=mimesis.ImageFile.PNG), f"{o.name}.thumbnail.png")
    )
    template = LazyFunction(lambda: default_certificate_template())
    active = True
    issuer = SubFactory(PartnerFactory)

    class Meta:
        model = Certificate
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        CertificateSkillFactory.create_batch(generic.random.randint(1, 3), certificate=self)
        CertificateEndorsementFactory.create_batch(generic.random.randint(1, 2), certificate=self)


class CertificateSkillFactory(DjangoModelFactory[CertificateSkill]):
    certificate = SubFactory(CertificateFactory)
    skill = Iterator(Skill.objects.all())
    coverage = 0.0

    class Meta:
        model = CertificateSkill
        django_get_or_create = ("certificate", "skill")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: CertificateSkill, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        factors = Factor.objects.filter(skill=self.skill)
        certificate_factors = factors[: generic.random.randint(1, len(factors))]
        self.coverage = len(certificate_factors) / len(factors) * 100
        self.save()

        self.factors.set(certificate_factors)


class CertificateEndorsementFactory(DjangoModelFactory[CertificateEndorsement]):
    certificate = SubFactory(CertificateFactory)
    partner = SubFactory(PartnerFactory)
    claim = FactoryField("sentence")
    endorsed = LazyFunction(lambda: timezone.now())

    class Meta:
        model = CertificateEndorsement
        django_get_or_create = ("certificate", "partner")


class CompetencyGoalFactory(DjangoModelFactory[CompetencyGoal]):
    user = SubFactory(UserFactory)
    name = LazyFunction(lambda: " ".join(generic.text.words(generic.random.randint(3, 5))))
    description = FactoryField("sentence")
    classification = Iterator(Classification.objects.filter(depth=4)[:10])

    class Meta:
        model = CompetencyGoal
        django_get_or_create = ("user", "name")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: CompetencyGoal, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        self.factors.set(Factor.objects.filter(skill__classification=self.classification))
