from typing import TYPE_CHECKING

import pghistory
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ImproperlyConfigured
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    CharField,
    ForeignKey,
    ImageField,
    JSONField,
    Model,
    Prefetch,
    Q,
    QuerySet,
    TextChoices,
    TextField,
    UniqueConstraint,
)
from django.utils.translation import gettext_lazy as _

from apps.common.error import ErrorCode
from apps.common.models import AttemptMixin, LearningObjectMixin, OrderableMixin, TimeStampedMixin
from apps.common.util import ModeChoices
from apps.operation.models import AttachmentMixin

User = get_user_model()


@pghistory.track()
class QuestionPool(Model):
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), default="", blank=True)
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"), related_name="+")

    class Meta:
        verbose_name = _("Question Pool")
        verbose_name_plural = _("Question Pools")
        constraints = [UniqueConstraint(fields=["title", "owner"], name="survey_questionpool_ti_ow_uniq")]

    if TYPE_CHECKING:
        questions: "QuerySet[Question]"


@pghistory.track()
class Question(OrderableMixin, AttachmentMixin):
    class SurveyQuestionFormatChoices(TextChoices):
        SINGLE_CHOICE = "single_choice", _("Single Choice")
        TEXT_INPUT = "text_input", _("Text Input")
        NUMBER_INPUT = "number_input", _("Number Input")

    pool = ForeignKey(QuestionPool, CASCADE, related_name="questions", verbose_name=_("Question Pool"))
    format = CharField(_("Format"), max_length=20, choices=SurveyQuestionFormatChoices.choices)
    question = TextField(_("Question"))
    supplement = TextField(_("Supplement"), blank=True, default="")
    options = ArrayField(TextField(), blank=True, default=list, verbose_name=_("Options"))
    mandatory = BooleanField(_("Mandatory"), default=True)

    ordering_group = ("pool",)

    class Meta(OrderableMixin.Meta):
        verbose_name = _("Question")
        verbose_name_plural = _("Questions")

    @property
    def cleaned_supplement(self):
        return self.update_attachment_urls(content=self.supplement)


@pghistory.track()
class Survey(LearningObjectMixin):
    thumbnail = ImageField(_("Thumbnail"))
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    question_pool = ForeignKey(QuestionPool, CASCADE, verbose_name=_("Question Pool"))
    complete_message = TextField(_("Complete Message"), blank=True, default="")
    anonymous = BooleanField(_("Anonymous"), default=True)
    show_results = BooleanField(_("Show Results"), default=False)

    class Meta(LearningObjectMixin.Meta):
        verbose_name = _("Survey")
        verbose_name_plural = _("Surveys")

    if TYPE_CHECKING:
        question_ids: list[int]  # annotated

    @classmethod
    async def get_survey(cls, id: str, anonymous: bool = False):
        qs = cls.objects.select_related("owner", "question_pool").prefetch_related(
            Prefetch(
                "question_pool__questions", queryset=Question.objects.prefetch_related("attachments").order_by("id")
            )
        )
        if anonymous:
            qs = qs.filter(anonymous=True)

        return await qs.aget(id=id)

    @classmethod
    async def analyze_answers(cls, id: str, anonymous: bool = False):
        from apps.survey.documents import SubmissionDocument

        qs = cls.objects.filter(anonymous=True) if anonymous else cls.objects.all()
        qs = qs.annotate(question_ids=ArrayAgg("question_pool"))
        survey = await qs.aget(id=id)

        if not survey.show_results:
            raise ValueError(ErrorCode.ACCESS_DENIED)

        return await sync_to_async(SubmissionDocument.analyze_answers)(question_ids=survey.question_ids)


@pghistory.track()
class Submission(AttemptMixin):
    survey = ForeignKey(Survey, CASCADE, verbose_name=_("Survey"))
    respondent = ForeignKey(User, SET_NULL, null=True, blank=True, related_name="+", verbose_name=_("Respondent"))
    answers = JSONField(_("Answers"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Submission")
        verbose_name_plural = _("Submissions")
        constraints = [
            UniqueConstraint(
                fields=["survey", "respondent", "context"],
                condition=Q(respondent__isnull=False, active=True),
                name="survey_submission_su_re_co_uniq",
            )
        ]

    def save(self, *args, **kwargs):
        if self.survey.anonymous:
            self.respondent = None
        super().save(*args, **kwargs)

    @classmethod
    async def submit(
        cls,
        *,
        survey_id: str,
        answers: dict[str, str],
        mode: ModeChoices,
        respondent_id: str | None = None,
        context: str = "",
        anonymous: bool = False,
    ):
        survey = await Survey.objects.aget(id=survey_id)

        if survey.anonymous:
            await Submission.objects.acreate(survey=survey, answers=answers, mode=mode)
        else:
            if anonymous:
                raise ValueError(ErrorCode.ANONYMOUS_NOT_ALLOWED)
            if not respondent_id:
                raise ImproperlyConfigured("Non anonymous submission requires respondent_id")
            await Submission.objects.aupdate_or_create(
                survey=survey,
                respondent_id=respondent_id,
                context=context,
                defaults={"answers": answers, "active": True, "mode": mode},
            )
