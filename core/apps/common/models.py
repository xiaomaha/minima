import logging
from datetime import timedelta
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db.models import (
    BooleanField,
    CharField,
    DateTimeField,
    DurationField,
    FloatField,
    ImageField,
    JSONField,
    Manager,
    Model,
    PositiveSmallIntegerField,
    QuerySet,
    TextField,
)
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.common.util import AccessDate, AttemptModeChoices, GradingDate, track_fields, tuid

log = logging.getLogger(__name__)


class TuidMixin(Model):
    id = CharField(_("ID"), max_length=12, primary_key=True, editable=False, default=tuid)

    class Meta:
        abstract = True

    if TYPE_CHECKING:
        pk: str


class TimeStampedMixin(Model):
    created = DateTimeField(_("Created"), auto_now_add=True, db_index=True)
    modified = DateTimeField(_("Modified"), auto_now=True, db_index=True)

    class Meta:
        abstract = True


class OrderableMixin(Model):
    ordering = PositiveSmallIntegerField(_("Ordering"), default=0, db_index=True)
    ordering_group: tuple[str, ...] | None = None

    class Meta:
        abstract = True

    if TYPE_CHECKING:
        pk: int | str

    def __init__(self, *args: object, **kwargs: object):
        super().__init__(*args, **kwargs)
        self._original_ordering = getattr(self, "ordering", None)

    def _get_filters(self):
        if not self.ordering_group:
            raise ValueError(_("ordering_group must be defined in subclass"))
        return {field: getattr(self, field) for field in self.ordering_group}

    def reorder(self, new_position: int):
        filters = self._get_filters()
        qs = self.__class__.objects.filter(**filters).exclude(pk=self.pk).order_by("ordering", "pk")
        items = list(qs)

        if new_position < 0:
            new_position = 0
        elif new_position > len(items):
            new_position = len(items)

        items.insert(new_position, self)

        for index, item in enumerate(items):
            item.ordering = index

        other_items = [item for item in items if item.pk and item != self]
        if other_items:
            self.__class__.objects.bulk_update(other_items, ["ordering"])

    def save(self, *args, **kwargs):
        if not self.pk:
            filters = self._get_filters()
            count = self.__class__.objects.filter(**filters).count()
            if getattr(self, "ordering", None) is None:
                self.ordering = count
            super().save(*args, **kwargs)
            self.reorder(new_position=self.ordering)
        else:
            super().save(*args, **kwargs)
            if self.ordering != self._original_ordering:
                self.reorder(new_position=self.ordering)


class SoftDeleteQuerySet(QuerySet):
    def active(self):
        return self.filter(deleted__isnull=True)


class SoftDeleteManager(Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).active()

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)


class SoftDeleteMixin(Model):
    deleted = DateTimeField(_("Deleted"), null=True, blank=True)

    objects = SoftDeleteManager()

    class Meta:
        abstract = True


class LearningObjectMixin(TuidMixin, TimeStampedMixin):
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), blank=True, default="")
    audience = TextField(_("Audience"), blank=True, default="")
    thumbnail = ImageField(_("Thumbnail"), null=True, blank=True)
    featured = BooleanField(_("Featured"), default=False)
    format = CharField(_("Format"), max_length=30, blank=True, default="")
    duration = DurationField(_("Duration"), null=True, blank=True)
    passing_point = PositiveSmallIntegerField(_("Passing Point"), default=60)
    max_attempts = PositiveSmallIntegerField(_("Max Attempts"), default=0)  # zero means unlimited
    verification_required = BooleanField(_("Verification Required"), default=False)
    published = BooleanField(_("Published"), default=False)

    class Meta(TuidMixin.Meta, TimeStampedMixin.Meta):
        abstract = True

    def __str__(self):
        return self.title

    @property
    def duration_seconds(self):
        return self.duration.total_seconds() if self.duration else None

    @duration_seconds.setter
    def duration_seconds(self, value: int | None):
        if value is None:
            self.duration = None
        else:
            self.duration = timedelta(seconds=value)


class AttemptMixin(Model):
    started = DateTimeField(_("Start Time"), default=timezone.now)
    active = BooleanField(_("Active"), default=True)
    context = CharField(_("Context Key"), max_length=255, blank=True, default="")
    mode = CharField(_("Mode"), max_length=30, choices=AttemptModeChoices.choices, default=AttemptModeChoices.NORMAL)

    class Meta:
        abstract = True


@track_fields("completed", "confirmed")
class GradeFieldMixin(Model):
    earned_details = JSONField(_("Earned Details"))
    possible_point = PositiveSmallIntegerField(_("Possible Point"))
    earned_point = PositiveSmallIntegerField(_("Earned Point"))
    score = FloatField(_("Score"))
    passed = BooleanField(_("Passed"), default=False)
    feedback = JSONField(_("Feedback"), blank=True, default=dict)
    completed = DateTimeField(_("Completed"), null=True, blank=True)
    confirmed = DateTimeField(_("Confirmed"), null=True, blank=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.confirmed and not self.completed:
            raise ValidationError(_("Cannot confirm without completion"))
        super().save(*args, **kwargs)


class GradeWorkflowMixin(Model):
    grade_due_days = PositiveSmallIntegerField(_("Grading Due Days"))
    appeal_deadline_days = PositiveSmallIntegerField(_("Appeal Deadline Days"))
    confirm_due_days = PositiveSmallIntegerField(_("Confirm Due Days"))

    class Meta:
        abstract = True

    def get_grading_date(self, access_date: AccessDate):
        access_end = access_date["end"]
        grade_due = access_end + timedelta(days=self.grade_due_days)
        appeal_deadline = grade_due + timedelta(days=self.appeal_deadline_days)
        confirm_due = appeal_deadline + timedelta(days=self.confirm_due_days)
        return GradingDate(grade_due=grade_due, appeal_deadline=appeal_deadline, confirm_due=confirm_due)
