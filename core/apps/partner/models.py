from typing import TYPE_CHECKING

import pghistory
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db.models import (
    CASCADE,
    SET_NULL,
    CharField,
    Count,
    DateField,
    EmailField,
    ForeignKey,
    ImageField,
    ManyToManyField,
    Prefetch,
    QuerySet,
    TextField,
    UniqueConstraint,
    URLField,
)
from django.db.models.base import Model
from django.db.models.enums import TextChoices
from django.db.models.indexes import Index
from django.utils.translation import gettext as t
from django.utils.translation import gettext_lazy as _
from phonenumber_field.modelfields import PhoneNumberField

from apps.common.models import TimeStampedMixin
from apps.common.util import track_fields
from apps.operation.models import MessageType, user_message_created

User = get_user_model()

if TYPE_CHECKING:
    from apps.account.models import User

PERSONAL_ID_SALT = settings.PERSONAL_ID_SALT


@pghistory.track()
class Partner(TimeStampedMixin):
    name = CharField(_("Name"), max_length=50, unique=True)
    description = TextField(_("Description"), blank=True, default="")
    phone = CharField(_("Phone"), max_length=20)  # char field
    email = EmailField(_("Email"))
    address = TextField(_("Address"), blank=True, default="")
    logo = ImageField(_("Logo"), null=True, blank=True)
    website = URLField(_("Website"), null=True, blank=True)

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Partner")
        verbose_name_plural = _("Partners")
        indexes = [Index(fields=["email"])]

    if TYPE_CHECKING:
        group_set: "QuerySet[Group]"

    def __str__(self):
        return self.name


@pghistory.track()
class Group(TimeStampedMixin):
    partner = ForeignKey(Partner, CASCADE, verbose_name=_("Partner"))
    name = CharField(_("Name"), max_length=50)
    description = TextField(_("Description"), blank=True, default="")
    business_number = CharField(_("Business Number"), max_length=50, unique=True)

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Group")
        verbose_name_plural = _("Groups")
        constraints = [UniqueConstraint(fields=["partner", "name"], name="partner_group_pa_na_uniq")]

    if TYPE_CHECKING:
        member_set: "QuerySet[Member]"

    def __str__(self):
        return self.name


@track_fields("user_id")
@pghistory.track()
class Member(TimeStampedMixin):
    group = ForeignKey(Group, CASCADE, verbose_name=_("Group"))
    name = CharField(_("Name"), max_length=50)
    email = EmailField(_("Email"))
    birth_date = DateField(_("Birth Date"), null=True, blank=True)
    encrypted_personal_id = CharField(_("ID Number"), blank=True, max_length=255)
    phone = PhoneNumberField(_("Phone"), blank=True, default="")
    team = CharField(_("Team"), blank=True, default="", max_length=50)
    job_position = CharField(_("Job Position"), blank=True, default="", max_length=50)
    job_title = CharField(_("Job Title"), blank=True, default="", max_length=50)
    employment_status = CharField(_("Employment Status"), blank=True, default="", max_length=50)
    employment_type = CharField(_("Employment Type"), blank=True, default="", max_length=50)
    user = ForeignKey(User, SET_NULL, null=True, blank=True, verbose_name=_("User"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Member")
        verbose_name_plural = _("Members")
        constraints = [UniqueConstraint(fields=["group", "email"], name="partner_member_si_em_uniq")]
        indexes = [Index(fields=["name"]), Index(fields=["email"]), Index(fields=["phone"]), Index(fields=["team"])]

    if TYPE_CHECKING:
        pgh_event_model: type[Model]
        cohortmember_set: "QuerySet[CohortMember]"
        user_id: str

    @classmethod
    def encrypt_personal_id(cls, personal_id: str):
        if not personal_id:
            return ""
        return signing.dumps(personal_id, salt=PERSONAL_ID_SALT)

    @classmethod
    def decrypt_personal_id(cls, encrypted_data: str):
        return signing.loads(encrypted_data, salt=PERSONAL_ID_SALT)

    def set_personal_id(self, personal_id: str):
        self.encrypted_personal_id = self.encrypt_personal_id(personal_id) if personal_id else ""

    def check_personal_id(self, personal_id: str):
        if not self.encrypted_personal_id and not personal_id:
            return True
        if not self.encrypted_personal_id or not personal_id:
            return False
        decrypted = self.decrypt_personal_id(self.encrypted_personal_id)
        return decrypted == personal_id

    def __str__(self):
        return f"{self.name} <{self.email}>"

    @classmethod
    async def member_infos(cls, *, user_id: str):
        return [
            m
            async for m in cls.objects
            .select_related("group__partner")
            .prefetch_related(
                Prefetch(
                    "cohortmember_set",
                    queryset=CohortMember.objects
                    .select_related("cohort")
                    .annotate(member_count=Count("cohort__members"))
                    .prefetch_related(
                        Prefetch("cohort__cohortstaff_set", queryset=CohortStaff.objects.select_related("staff"))
                    ),
                )
            )
            .annotate(member_count=Count("group__member", distinct=True))
            .filter(user=user_id)
        ]

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)

        if is_new and self.user_id:
            user_message_created.send(
                source=self.group,
                path="",
                message=MessageType(user_id=self.user_id, title=t("Cohort Membership Added"), body=self.group.name),
            )

    def on_user_id_changed(self, old_value):
        if self.user_id:
            user_message_created.send(
                source=self.group,
                path="",
                message=MessageType(user_id=self.user_id, title=t("Cohort Membership Changed"), body=self.group.name),
            )


@pghistory.track()
class Cohort(TimeStampedMixin):
    name = CharField(_("Name"), max_length=50, unique=True)
    description = TextField(_("Description"), blank=True, default="")
    members = ManyToManyField(Member, through="CohortMember", verbose_name=_("Members"))
    staffs = ManyToManyField(User, through="CohortStaff", blank=True, verbose_name=_("Staffs"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Cohort")
        verbose_name_plural = _("Cohorts")

    def __str__(self):
        return self.name

    if TYPE_CHECKING:
        member_count: int  # annotated
        cohortstaff_set: "QuerySet[CohortStaff]"


@pghistory.track()
class CohortMember(TimeStampedMixin):
    cohort = ForeignKey(Cohort, CASCADE, verbose_name=_("Cohort"))
    member = ForeignKey(Member, CASCADE, verbose_name=_("Member"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Cohort Member")
        verbose_name_plural = _("Cohort Members")
        constraints = [UniqueConstraint(fields=["cohort", "member"], name="partner_cohortmember_co_em_uniq")]

    if TYPE_CHECKING:
        member_count: int  # annotated


@pghistory.track()
class CohortStaff(Model):
    class RoleChoices(TextChoices):
        EDUCATION_MANAGER = "education_manager", _("Education Manager")

    cohort = ForeignKey(Cohort, CASCADE, verbose_name=_("Cohort"))
    staff = ForeignKey(User, CASCADE, verbose_name=_("User"))
    role = CharField(_("Role"), max_length=30, choices=RoleChoices)

    class Meta:
        verbose_name = _("Cohort Staff")
        verbose_name_plural = _("Cohort Staffs")
        constraints = [UniqueConstraint(fields=["cohort", "staff"], name="partner_cohortstaff_co_sta_uniq")]
