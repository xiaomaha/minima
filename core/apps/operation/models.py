import hashlib
import mimetypes
import os
import re
from datetime import datetime
from typing import TYPE_CHECKING, Any, Sequence, cast

import pghistory
from asgiref.sync import sync_to_async
from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.fields import ArrayField
from django.core.files import File
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    Case,
    CharField,
    Count,
    DateTimeField,
    EmailField,
    Exists,
    F,
    FileField,
    FloatField,
    ForeignKey,
    ImageField,
    Index,
    IntegerField,
    JSONField,
    ManyToManyField,
    Model,
    OneToOneField,
    OuterRef,
    PositiveIntegerField,
    PositiveSmallIntegerField,
    Prefetch,
    Q,
    QuerySet,
    Subquery,
    TextChoices,
    TextField,
    UniqueConstraint,
    Value,
    When,
    Window,
)
from django.db.models.functions.window import RowNumber
from django.dispatch import Signal, receiver
from django.utils import timezone
from django.utils.translation import gettext as t
from django.utils.translation import gettext_lazy as _
from taggit.managers import TaggableManager
from taggit.models import CommonGenericTaggedItemBase, TagBase, TaggedItemBase
from treebeard.mp_tree import MP_Node
from typing_extensions import TypedDict

from apps.common.error import ErrorCode
from apps.common.models import OrderableMixin, SoftDeleteMixin, TimeStampedMixin
from apps.common.util import track_fields
from apps.operation.fcm import send_fcm
from apps.operation.trigger import thread_comment_stats

User = get_user_model()


@pghistory.track()
class Category(MP_Node):
    name = CharField(_("Name"), max_length=100)
    ancestors = ArrayField(CharField(_("Ancestors"), max_length=200), editable=False)

    class Meta:
        verbose_name = _("Category")
        verbose_name_plural = _("Categories")

    if TYPE_CHECKING:
        pk: int

    def __str__(self):
        return " / ".join(self.ancestors + [self.name])

    def save(self, *args, **kwargs):
        parent = cast(Category, self.get_parent())
        self.ancestors = parent.ancestors + [parent.name] if parent else []
        return super().save(*args, **kwargs)


@pghistory.track()
class Tag(TagBase):
    class Meta:
        verbose_name = _("Tag")
        verbose_name_plural = _("Tags")


@pghistory.track()
class TaggedItem(CommonGenericTaggedItemBase, TaggedItemBase):
    object_id = CharField(_("Object ID"), max_length=36)
    tag = ForeignKey(Tag, CASCADE, related_name="%(app_label)s_%(class)s_items", verbose_name=_("Tag"))

    class Meta:
        verbose_name = _("Tagged Item")
        verbose_name_plural = _("Tagged Items")
        indexes = [Index(fields=["content_type", "object_id"]), Index(fields=["object_id"])]
        constraints = [
            UniqueConstraint(fields=["tag", "content_type", "object_id"], name="operation_taggeditem_ta_coty_obid_uniq")
        ]


class TaggableMixin(Model):
    tags = TaggableManager(through=TaggedItem, blank=True)

    class Meta:
        abstract = True

    def set_tags(self, tag_names: list[str] | None):
        if tag_names:
            self.tags.set(tag_names)
        else:
            self.tags.clear()


@pghistory.track()
class Attachment(SoftDeleteMixin, TimeStampedMixin):
    file = FileField(_("File"), max_length=255, unique=True)
    size = IntegerField(_("Size"), null=True, blank=True)
    mime_type = CharField(_("Mime Type"), max_length=100)
    hash = CharField(max_length=64, db_index=True)
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    deleted = DateTimeField(_("Deleted"), null=True, blank=True)

    class Meta:
        verbose_name = _("Attachment")
        verbose_name_plural = _("Attachments")
        constraints = [UniqueConstraint(fields=["hash", "owner"], name="operation_attachment_ha_own_uniq")]

    def fill_metadata(self):
        self.size = self.file.size
        self.mime_type = mimetypes.guess_type(self.file.name)[0] or ""
        self.hash = self.calculate_hash()

    def calculate_hash(self) -> str:
        hasher = hashlib.sha256()
        hasher.update(self.file.name.encode())
        for chunk in self.file.chunks():
            hasher.update(chunk)
        return hasher.hexdigest()


ATTACHMENT_MAX_COUNT = settings.ATTACHMENT_MAX_COUNT
ATTACHMENT_MAX_SIZE = settings.ATTACHMENT_MAX_SIZE_MB * 1024 * 1024


class AttachmentMixin(Model):
    attachments = ManyToManyField(Attachment, verbose_name=_("Attachments"), blank=True, related_name="+")

    class Meta:
        abstract = True

    def restore_filename(self, filename: str) -> str:
        name, ext = os.path.splitext(filename)
        parts = name.rsplit(".", 1)
        if len(parts) == 2:
            return f"{parts[0]}{ext}"
        return filename

    def _extract_used_filenames(self, content: str) -> set[str]:
        used_filenames = set()

        img_matches = re.findall(r'<img[^>]*alt="([^"]*)"[^>]*>', content)
        used_filenames.update(img_matches)

        link_matches = re.findall(r'<a[^>]*download="([^"]*)"[^>]*>', content)
        used_filenames.update(link_matches)

        return used_filenames

    async def update_attachments(self, *, files: Sequence[File] | None, owner_id: str, content: str):
        used_filenames = self._extract_used_filenames(content)
        attachments_to_keep: list[Attachment] = []
        seen_hashes = set()

        existing_attachments = []
        if self.pk:
            cached = (
                self._prefetched_objects_cache.get("attachments")
                if hasattr(self, "_prefetched_objects_cache")
                else None
            )

            if cached is not None:
                existing_attachments = list(cached)
            else:
                async for a in self.attachments.all():
                    existing_attachments.append(a)

            for a in existing_attachments:
                if self.restore_filename(a.file.name) in used_filenames:
                    attachments_to_keep.append(a)
                    seen_hashes.add((a.hash, owner_id))

        new_attachments_to_create: list[Attachment] = []
        for f in files or []:
            attachment = Attachment(file=f, owner_id=owner_id, deleted=None)
            attachment.fill_metadata()
            hash_key = (attachment.hash, owner_id)

            if hash_key not in seen_hashes and f.name in used_filenames:
                new_attachments_to_create.append(attachment)
                seen_hashes.add(hash_key)

        if new_attachments_to_create:
            created = await Attachment.objects.abulk_create(
                new_attachments_to_create,
                update_conflicts=True,
                update_fields=["deleted"],
                unique_fields=["hash", "owner"],
            )
            attachments_to_keep.extend(created)

        existing_ids = set(a.id for a in existing_attachments)
        new_ids = set(a.pk for a in attachments_to_keep)
        if existing_ids != new_ids:
            if hasattr(self, "_prefetched_objects_cache"):
                self._prefetched_objects_cache.pop("attachments", None)
            await self.attachments.aset(attachments_to_keep)

        if hasattr(self, "_prefetched_objects_cache"):
            self._prefetched_objects_cache["attachments"] = attachments_to_keep
        else:
            self._prefetched_objects_cache = {"attachments": attachments_to_keep}

        return attachments_to_keep

    def update_attachment_urls(self, *, content: str):
        attachments = self.attachments.all()
        if not attachments:
            return content

        for attachment in attachments:
            original_name = self.restore_filename(attachment.file.name)
            presigned_url = attachment.file.storage.url(attachment.file.name)
            escaped_name = re.escape(original_name)

            img_pattern = f'<img[^>]*alt="{escaped_name}"[^>]*>'

            def replace_src(match):
                img_tag = match.group(0)
                return re.sub(r'src="[^"]*"', f'src="{presigned_url}"', img_tag)

            content = re.sub(img_pattern, replace_src, content)

            link_pattern = f'<a[^>]*download="{escaped_name}"[^>]*>'

            def replace_href(match):
                a_tag = match.group(0)
                return re.sub(r'href="[^"]*"', f'href="{presigned_url}"', a_tag)

            content = re.sub(link_pattern, replace_href, content)

        return content


@pghistory.track()
class Announcement(TimeStampedMixin, AttachmentMixin):
    title = CharField(_("Title"), max_length=255, unique=True)
    body = TextField(_("Body"))
    public = BooleanField(_("Public"), default=True)
    pinned = BooleanField(_("Pinned"), default=False)
    writer = ForeignKey(User, CASCADE, verbose_name=_("Writer"))

    class Meta:
        verbose_name = _("Announcement")
        verbose_name_plural = _("Announcements")

    if TYPE_CHECKING:
        pk: int

    def __str__(self):
        return self.title

    @property
    def cleaned_body(self):
        return self.update_attachment_urls(content=self.body)

    @classmethod
    def get_announcements(cls, user_id: str):
        return (
            cls.objects
            .prefetch_related("attachments")
            .annotate(
                read=Subquery(
                    AnnouncementRead.objects.filter(announcement_id=OuterRef("pk"), user_id=user_id).values("read")[:1]
                )
            )
            .filter(public=True)
            .order_by("-pinned", "-id")
        )

    @classmethod
    async def create(
        cls, *, title: str, body: str, public: bool, pinned: bool, files: Sequence[File] | None, writer_id: str
    ):
        an = await cls.objects.acreate(title=title, body=body, public=public, pinned=pinned, writer_id=writer_id)
        await an.update_attachments(files=files, owner_id=writer_id, content=an.body)
        return an


@pghistory.track()
class AnnouncementRead(Model):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    announcement = ForeignKey(Announcement, CASCADE, related_name="reads", verbose_name=_("Announcement"))
    read = DateTimeField(_("Read at"), auto_now_add=True)

    class Meta:
        verbose_name = _("Announcement Read")
        verbose_name_plural = _("Announcement Reads")
        constraints = [UniqueConstraint(fields=["user", "announcement"], name="operation_announcementread_us_an_uniq")]


@pghistory.track()
class Instructor(TimeStampedMixin):
    name = CharField(_("Name"), max_length=50)
    email = EmailField(_("Email"), unique=True)
    about = TextField(_("About"))
    bio = ArrayField(CharField(max_length=200), verbose_name=_("Bio"))
    avatar = ImageField(_("Avatar"), null=True, blank=True)
    active = BooleanField(_("Active"), default=True)

    class Meta:
        verbose_name = _("Instructor")
        verbose_name_plural = _("Instructors")
        indexes = [Index(fields=["name"])]

    if TYPE_CHECKING:
        pk: int

    def __str__(self):
        return self.name


@pghistory.track()
class HonorCode(TimeStampedMixin):
    title = CharField(_("Title"), max_length=255, unique=True)
    code = TextField(_("Code"))

    class Meta:
        verbose_name = _("Honor Code")
        verbose_name_plural = _("Honor Codes")

    def __str__(self):
        return self.title


@pghistory.track()
class FAQ(Model):
    name = CharField(_("Name"), max_length=255, unique=True)
    description = TextField(_("Description"), blank=True, default="")

    class Meta:
        verbose_name = _("FAQ")
        verbose_name_plural = _("FAQs")

    def __str__(self):
        return self.name

    if TYPE_CHECKING:
        items: QuerySet[FAQItem]


@pghistory.track()
class FAQItem(OrderableMixin, TimeStampedMixin):
    faq = ForeignKey(FAQ, CASCADE, related_name="items", verbose_name=_("FAQ"))
    question = CharField(_("Question"), max_length=255)
    answer = TextField(_("Answer"))
    active = BooleanField(_("Active"), default=True)
    ordering_group = ("faq",)

    class Meta:
        verbose_name = _("FAQ")
        verbose_name_plural = _("FAQs")
        constraints = [UniqueConstraint(fields=["faq", "question"], name="operation_faqitem_fa_qu_uniq")]


@pghistory.track()
class Inquiry(TimeStampedMixin, AttachmentMixin):
    title = CharField(_("Title"), max_length=255)
    question = TextField(_("Question"))
    writer = ForeignKey(User, CASCADE, verbose_name=_("Writer"))
    content_type = ForeignKey(ContentType, CASCADE, verbose_name=_("Content Type"))
    content_id = CharField(_("Content ID"), max_length=36, db_index=True)
    content = GenericForeignKey("content_type", "content_id")

    class Meta:
        verbose_name = _("Inquiry")
        verbose_name_plural = _("Inquiries")
        indexes = [Index(fields=["content_type", "content_id"])]

    if TYPE_CHECKING:
        solved: datetime  # annotated
        inquiry_responses: "QuerySet[InquiryResponse]"
        response_count: int  # annotated
        writer_id: str

    @property
    def responses(self):
        return self.inquiry_responses.all()

    @property
    def cleaned_question(self):
        return self.update_attachment_urls(content=self.question)

    @classmethod
    async def create(
        cls,
        *,
        title: str,
        question: str,
        app_label: str,
        model: str,
        content_id: int,
        writer_id: str,
        files: Sequence[File] | None,
    ):
        content_type = await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, model)
        inquiry = await cls.objects.acreate(
            title=title, question=question, writer_id=writer_id, content_type=content_type, content_id=content_id
        )
        await inquiry.update_attachments(files=files, owner_id=writer_id, content=inquiry.question)
        return inquiry

    @classmethod
    async def update(cls, *, title: str, question: str, writer_id: str, id: int, files: Sequence[File] | None):
        inquiry = (
            await cls.objects
            .select_related("writer")
            .annotate(response_count=Count("inquiryresponse"))
            .aget(id=id, writer_id=writer_id)
        )

        if inquiry.response_count > 0:
            raise ValueError(ErrorCode.RESPONSE_EXISTS)

        inquiry.title = title
        inquiry.question = question
        await inquiry.asave()
        await inquiry.update_attachments(files=files, owner_id=writer_id, content=inquiry.question)
        return inquiry


@pghistory.track()
class InquiryResponse(TimeStampedMixin):
    inquiry = ForeignKey(Inquiry, CASCADE, related_name="inquiry_responses", verbose_name=_("Inquiry"))
    answer = TextField(_("Answer"))
    writer = ForeignKey(User, CASCADE, verbose_name=_("Writer"))
    solved = DateTimeField(_("Solved"), null=True, blank=True)

    class Meta:
        verbose_name = _("Inquiry Response")
        verbose_name_plural = _("Inquiry Responses")
        constraints = [
            UniqueConstraint(
                fields=["inquiry"], condition=Q(solved__isnull=False), name="operation_inquiryresponse_in_sol_uniq"
            )
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        user_message_created.send(
            source=self.inquiry,
            message=MessageType(
                user_id=self.inquiry.writer_id, title=t("Inquiry response added"), body=self.inquiry.title
            ),
        )


@track_fields("review")
@pghistory.track()
class Appeal(TimeStampedMixin, AttachmentMixin):
    learner = ForeignKey(User, CASCADE, verbose_name=_("Learner"), related_name="+")
    explanation = TextField(_("Explanation"))
    review = TextField(_("Review"), blank=True, default="")
    reviewer = ForeignKey(User, CASCADE, verbose_name=_("Reviewer"), null=True, related_name="+")

    limit_choices_to = {"model__in": ["exam", "assignment", "discussion"]}
    assessment_type = ForeignKey(
        ContentType, CASCADE, verbose_name=_("Assessment Type"), limit_choices_to=limit_choices_to
    )
    assessment_id = CharField(_("Assessment ID"), max_length=12)  # actually tuid
    assessment = GenericForeignKey("assessment_type", "assessment_id")
    question_id = IntegerField(_("Question ID"))

    class Meta:
        verbose_name = _("Grade Appeal")
        verbose_name_plural = _("Grade Appeals")
        constraints = [
            UniqueConstraint(
                fields=["assessment_type", "assessment_id", "learner", "question_id"],
                name="operation_appeal_asty_asid_le_quid_uniq",
            )
        ]
        indexes = [Index(fields=["assessment_type", "assessment_id", "question_id"])]

    if TYPE_CHECKING:
        learner_id: str
        reviewer_id: str

    @property
    def cleaned_explanation(self):
        return self.update_attachment_urls(content=self.explanation)

    @classmethod
    async def create(
        cls,
        *,
        learner_id: str,
        assessment_id: str,
        app_label: str,
        model: str,
        question_id: int,
        explanation: str,
        files: Sequence[File] | None,
    ):
        assessment_type = await sync_to_async(ContentType.objects.get_by_natural_key)(app_label, model)
        appeal, created = await cls.objects.aget_or_create(
            learner_id=learner_id,
            assessment_type=assessment_type,
            assessment_id=assessment_id,
            question_id=question_id,
            defaults={"explanation": explanation},
        )

        if not created:
            raise ValueError(ErrorCode.ALREADY_EXISTS)

        await appeal.update_attachments(files=files, owner_id=learner_id, content=appeal.explanation)
        return appeal

    def on_review_changed(self, old_value: str):
        if not old_value and self.review:
            user_message_created.send(
                source=self.assessment,
                message=MessageType(
                    user_id=self.learner_id, title=t("Grade Appeal Resolved"), body=self.explanation[:50]
                ),
            )


@pghistory.track(exclude=["body"])
class Message(TimeStampedMixin):
    user = ForeignKey(User, SET_NULL, null=True, blank=True, verbose_name=_("User"))
    title = CharField(_("Title"), max_length=255)
    body = TextField(_("Body"))
    group = CharField(_("Group"), blank=True, default="", max_length=255)
    data = JSONField(_("Data"), default=dict, blank=True)

    class Meta:
        verbose_name = _("Message")
        verbose_name_plural = _("Messages")
        indexes = [Index(fields=["group"])]

    if TYPE_CHECKING:
        read: datetime | None  # annotated
        user_id: str

    @classmethod
    def get_unread_messages(cls, user_id: str):
        return (
            cls.objects.annotate(read=F("messageread__read")).filter(user_id=user_id, read__isnull=True).order_by("-id")
        )


class MessageRead(Model):
    message = OneToOneField(Message, CASCADE, verbose_name=_("Message"))
    read = DateTimeField(_("Read at"), auto_now_add=True)

    class Meta:
        verbose_name = _("Message Read")
        verbose_name_plural = _("Message Reads")


class MessageDataDict(TypedDict, extra_items=Any):
    app_label: str
    model: str
    object_id: int | str


class MessageType(TypedDict):
    user_id: str
    title: str
    body: str


class MessageSignal(Signal):
    def send(self, *, source: Model, message: MessageType, **kwargs):
        return super().send(sender=source.__class__, source=source, message=message, **kwargs)


user_message_created = MessageSignal()


@receiver(user_message_created)
def user_message_created_receiver(source: Model, message: MessageType, **kwargs):
    data: MessageDataDict = {
        "app_label": source._meta.app_label,
        "model": source._meta.model.__name__.lower(),
        "object_id": source.pk,
    }
    msg = Message.objects.create(**message, data=data)

    # TODO background task

    tokens = list(NotificationDevice.objects.filter(user_id=msg.user_id, active=True).values_list("token", flat=True))
    if tokens:
        send_fcm(tokens=tokens, title=msg.title, body=msg.body, data=msg.data)


@pghistory.track()
class NotificationDevice(TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    token = CharField(_("Token"), max_length=255, unique=True)
    platform = CharField(_("Platform"), max_length=50)
    device_name = CharField(_("Device Name"), max_length=100)
    active = BooleanField(_("Active"), default=True)

    class Meta:
        verbose_name = _("Notification Device")
        verbose_name_plural = _("Notification Devices")

    @classmethod
    async def toggle_active(cls, id: int):
        await cls.objects.filter(id=id).aupdate(active=Case(When(active=True, then=Value(False)), default=Value(True)))


@pghistory.track()
class Policy(TimeStampedMixin):
    class KindChoices(TextChoices):
        TERMS_OF_SERVICE = "terms_of_service", _("Terms of Service")
        PRIVACY_POLICY = "privacy_policy", _("Privacy Policy")
        COOKIE_POLICY = "cookie_policy", _("Cookie Policy")
        MARKETING_POLICY = "marketing_policy", _("Marketing Policy")
        DATA_RETENTION_POLICY = "data_retention_policy", _("Data Retention Policy")

    kind = CharField(_("Kind"), max_length=30, choices=KindChoices, unique=True)
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), blank=True, default="")
    active = BooleanField(_("Active"), default=True)
    mandatory = BooleanField(_("Mandatory"), default=True)
    priority = PositiveSmallIntegerField(_("Priority"))

    class Meta:
        verbose_name = _("Policy")
        verbose_name_plural = _("Policies")

    if TYPE_CHECKING:
        policy_versions: QuerySet[PolicyVersion]
        effective_version: PolicyVersion

    def __str__(self):
        return self.title

    @classmethod
    async def effective_policies(cls, *, user_id: str | None = None):
        latest_versions_qs = (
            PolicyVersion.objects
            .filter(effective_date__lte=timezone.now())
            .annotate(
                row_number=Window(
                    expression=RowNumber(),
                    partition_by=[F("policy_id")],
                    order_by=[F("effective_date").desc(), F("id").desc()],
                )
            )
            .filter(row_number=1)
            .order_by("-effective_date", "-id")
        )

        if user_id is not None:
            latest_versions_qs = latest_versions_qs.annotate(
                accepted=Exists(
                    PolicyAgreement.objects.filter(user_id=user_id, version_id=OuterRef("id"), accepted=True)
                )
            )

        policies = [
            policy
            async for policy in cls.objects
            .filter(active=True, policy_versions__id__in=Subquery(latest_versions_qs.values("id")))
            .prefetch_related(Prefetch("policy_versions", queryset=latest_versions_qs))
            .order_by("priority")
            .distinct()
        ]

        effectives = []
        for policy in policies:
            effective_versions = policy.policy_versions.all()
            if effective_versions:
                policy.effective_version = effective_versions[0]
                effectives.append(policy)

        return effectives


@pghistory.track()
class PolicyVersion(TimeStampedMixin):
    policy = ForeignKey(Policy, CASCADE, related_name="policy_versions", verbose_name=_("Policy"))
    body = TextField(_("Body"))
    data_category = JSONField(_("Data Category"), blank=True, default=dict)
    version = CharField(_("Version"), max_length=20)
    effective_date = DateTimeField(_("Effective Date"), default=timezone.now)

    class Meta:
        verbose_name = _("Policy Version")
        verbose_name_plural = _("Policy Versions")
        constraints = [UniqueConstraint(fields=["policy", "version"], name="operation_policyversion_po_ve_uniq")]

    @classmethod
    def get_latest_mandatory_versions_subquery(cls):
        return (
            cls.objects
            .filter(effective_date__lte=timezone.now(), policy__active=True, policy__mandatory=True)
            .annotate(
                row_number=Window(
                    expression=RowNumber(),
                    partition_by=[F("policy_id")],
                    order_by=[F("effective_date").desc(), F("id").desc()],
                )
            )
            .filter(row_number=1)
        )

    @classmethod
    async def get_effective_mandatory_version_ids(cls):
        version_ids = cls.get_latest_mandatory_versions_subquery().values_list("id", flat=True)
        return [version_id async for version_id in version_ids]


@pghistory.track()
class PolicyAgreement(TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    version = ForeignKey(PolicyVersion, CASCADE, verbose_name=_("Policy Version"))
    accepted = BooleanField(_("Accepted"), null=True, blank=True)

    class Meta:
        verbose_name = _("Policy Agreement")
        verbose_name_plural = _("Policy Agreements")
        indexes = [Index(fields=["user", "accepted"])]
        constraints = [UniqueConstraint(fields=["user", "version"], name="operation_policyagreement_us_ve_uniq")]

    @classmethod
    async def agree_policies(cls, *, user_id: str, agreements: dict[str, bool | None]):
        agreement_objects = [
            cls(user_id=user_id, version_id=int(version_id), accepted=accepted)
            for version_id, accepted in agreements.items()
            if str(version_id).isdigit()
        ]
        await cls.objects.abulk_create(
            agreement_objects, update_conflicts=True, unique_fields=["user", "version"], update_fields=["accepted"]
        )

    if TYPE_CHECKING:
        pgh_event_model: type[Model]


@pghistory.track()
class Thread(TimeStampedMixin):
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), blank=True, default="")
    subject_type = ForeignKey(ContentType, CASCADE, verbose_name=_("Subject Type"))
    subject_id = CharField(_("Subject ID"), max_length=36)
    subject = GenericForeignKey("subject_type", "subject_id")
    comment_count = PositiveIntegerField(_("Comment Count"), default=0)
    rating_count = PositiveIntegerField(_("Rating Count"), default=0)
    rating_sum = PositiveIntegerField(_("Rating Sum"), default=0)
    rating_avg = FloatField(_("Rating Average"), default=0)
    closed = DateTimeField(_("Closed"), null=True, blank=True)

    class Meta:
        verbose_name = _("Thread")
        verbose_name_plural = _("Threads")
        constraints = [UniqueConstraint(fields=["subject_type", "subject_id"], name="opeation_thread_suty_suid_uniq")]

    if TYPE_CHECKING:
        pk: int

    def __str__(self):
        return f"{self.pk} - {self.title[:10]}"


@pghistory.track()
class Comment(TimeStampedMixin, AttachmentMixin):
    thread = ForeignKey(Thread, CASCADE, verbose_name=_("Thread"))
    parent = ForeignKey("self", CASCADE, null=True, blank=True, related_name="children", verbose_name=_("Parent"))
    comment = TextField(_("Comment"), max_length=5000)
    pinned = BooleanField(_("Pinned"), default=False)
    deleted = BooleanField(_("Deleted"), default=False)
    rating = PositiveSmallIntegerField(_("Rating"), null=True, blank=True)
    writer = ForeignKey(User, CASCADE, verbose_name=_("Writer"))

    class Meta:
        verbose_name = _("Comment")
        verbose_name_plural = _("Comments")

    if TYPE_CHECKING:
        pk: int
        parent_id: int
        children: QuerySet[Comment]
        writer_id: str

    def __str__(self):
        return f"{self.pk} - {self.comment[:10]}"

    @property
    def comment_brief(self):
        content = BeautifulSoup(self.comment, "html.parser").get_text(separator=" ", strip=True)
        return content[:100] if (content and len(content) > 100) else content

    @property
    def cleaned_comment(self):
        if self.deleted:
            return "[DELETED]"
        return self.update_attachment_urls(content=self.comment)

    @classmethod
    async def upsert(cls, *, files: Sequence[File] | None, id: int | None = None, **data):
        comment, _ = await cls.objects.aupdate_or_create(id=id, defaults=data)

        await comment.update_attachments(files=files, owner_id=data.pop("writer_id"), content=comment.comment)
        return comment

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.parent:
            user_message_created.send(
                source=self.thread,
                message=MessageType(
                    user_id=self.parent.writer_id, title=t("Comment Reply Added"), body=self.parent.comment[:50]
                ),
            )


setattr(Comment._meta, "triggers", thread_comment_stats(Thread._meta.db_table, Comment._meta.db_table))
