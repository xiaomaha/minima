from datetime import datetime, timedelta
from typing import TYPE_CHECKING, NotRequired, Sequence, TypedDict

import pghistory
from asgiref.sync import sync_to_async
from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.core.files import File
from django.core.signing import dumps
from django.db.models import (
    CASCADE,
    SET_NULL,
    CharField,
    F,
    FileField,
    FloatField,
    ForeignKey,
    Index,
    Model,
    OneToOneField,
    PositiveSmallIntegerField,
    Prefetch,
    Q,
    QuerySet,
    TextChoices,
    TextField,
    UniqueConstraint,
    aprefetch_related_objects,
)
from django.db.utils import IntegrityError
from django.utils import timezone
from django.utils.translation import gettext as t
from django.utils.translation import gettext_lazy as _
from tika import parser

from apps.account.models import OtpLog
from apps.assignment.trigger import attempt_retry_count
from apps.common.error import ErrorCode
from apps.common.models import AttemptMixin, GradeFieldMixin, GradeWorkflowMixin, LearningObjectMixin, TimeStampedMixin
from apps.common.util import (
    AccessDate,
    GradingDate,
    LearningSessionStep,
    OtpTokenDict,
    RealmChoices,
    ScoreStatsDict,
    get_score_stats,
)
from apps.operation.models import Appeal, AttachmentMixin, HonorCode, MessageType, user_message_created

User = get_user_model()

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser as User


class PlagiarismDetectedException(ValueError):
    def __init__(self, similarity):
        self.similarity = similarity
        super().__init__(f"Plagiarism detected: {similarity}%")


class SessionDict(TypedDict):
    access_date: AccessDate
    grading_date: GradingDate
    step: LearningSessionStep
    assignment: "Assignment"
    attempt: NotRequired["Attempt"]
    submission: NotRequired["Submission"]
    grade: NotRequired["Grade"]
    appeal: NotRequired["Appeal"]
    analysis: NotRequired["dict[str, dict[str, int]]"]
    stats: NotRequired[ScoreStatsDict]
    otp_token: NotRequired[str]


@pghistory.track()
class QuestionPool(Model):
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), blank=True, default="")
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"), related_name="+")

    class Meta:
        verbose_name = _("Question Pool")
        verbose_name_plural = _("Question Pools")
        constraints = [UniqueConstraint(fields=["title", "owner"], name="assignment_questionpool_ti_ow_uniq")]

    if TYPE_CHECKING:
        questions: "QuerySet[Question]"

    def __str__(self):
        return self.title

    async def select_question(self):
        question = await self.questions.order_by("?").afirst()
        if not question:
            raise ValueError(ErrorCode.QUESTION_POOL_EMPTY)

        return question


@pghistory.track()
class Question(AttachmentMixin):
    pool = ForeignKey(QuestionPool, CASCADE, related_name="questions", verbose_name=_("Question Pool"))
    question = TextField(_("Question"))
    supplement = TextField(_("Supplement"), blank=True, default="")
    attachment_file_count = PositiveSmallIntegerField(_("Attachment File Count"), default=1)
    attachment_file_types = ArrayField(CharField(max_length=10), blank=True, default=list, verbose_name=_("Attachment File Types"))  # fmt: off
    plagiarism_threshold = PositiveSmallIntegerField(_("Plagiarism Threshold Percentage"))

    class Meta:
        verbose_name = _("Question")
        verbose_name_plural = _("Questions")

    @property
    def cleaned_supplement(self):
        return self.update_attachment_urls(content=self.supplement)


@pghistory.track()
class Assignment(LearningObjectMixin, GradeWorkflowMixin):
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    honor_code = ForeignKey(HonorCode, CASCADE, verbose_name=_("Honor Code"))
    question_pool = ForeignKey(QuestionPool, CASCADE, verbose_name=_("Question Pool"))
    rubric = ForeignKey("Rubric", CASCADE, verbose_name=_("Rubric"))
    sample_attachment = FileField(_("Sample Attachment"), max_length=255, blank=True, null=True)

    class Meta(LearningObjectMixin.Meta, GradeWorkflowMixin.Meta):
        verbose_name = _("Assignment")
        verbose_name_plural = _("Assignments")
        constraints = [UniqueConstraint(fields=["owner", "title"], name="assignment_assignment_ow_ti_uniq")]

    if TYPE_CHECKING:
        question_pool_id: int
        pk: str

    @property
    def sample_attachment_url(self):
        if self.sample_attachment:
            return self.sample_attachment.url

    @property
    def rubric_data(self):
        return getattr(self, "_rubric_data", None)

    @rubric_data.setter
    def rubric_data(self, data: RubricDataDict):
        self._rubric_data = data

    @classmethod
    async def get_session(cls, *, assignment_id: str, learner_id: str, context: str, access_date: AccessDate):
        assignment = (
            await Assignment.objects
            .select_related("owner", "honor_code", "question_pool")
            .prefetch_related("rubric__rubric_criteria__performance_levels")
            .aget(id=assignment_id)
        )
        assignment.rubric_data = await assignment.get_rubric_data()

        session = SessionDict(
            access_date=access_date,
            grading_date=assignment.get_grading_date(access_date),
            step=LearningSessionStep.READY,
            assignment=assignment,
        )

        attempt = (
            await Attempt.objects
            .filter(assignment_id=assignment_id, learner_id=learner_id, context=context, active=True)
            .select_related("assignment", "submission", "grade")
            .prefetch_related("question__attachments")
            .alast()
        )

        if not attempt:
            if assignment.verification_required:
                session["otp_token"] = dumps(
                    OtpTokenDict(
                        consumer_id=assignment.pk, app_label="assignment", model="assignment", user_id=learner_id
                    )
                )
            return session

        session["attempt"] = attempt

        if not hasattr(attempt, "submission"):
            session["step"] = LearningSessionStep.SITTING
            return session

        session["submission"] = attempt.submission
        attempt.submission._prefetched_objects_cache = {
            "attachments": [a async for a in attempt.submission.attachments.all()]
        }

        if not hasattr(attempt, "grade") or not attempt.grade.completed:
            session["step"] = LearningSessionStep.GRADING
            return session

        session["grade"] = attempt.grade
        session["analysis"] = await assignment.analyze_answers([attempt.question_id])

        try:
            session["appeal"] = await Appeal.objects.prefetch_related("attachments").aget(
                question_id=attempt.question_id, learner_id=learner_id
            )
        except Appeal.DoesNotExist:
            pass

        if not attempt.grade.confirmed:
            session["step"] = LearningSessionStep.REVIEWING
            return session

        session["stats"] = await get_score_stats(
            base_model=Assignment, base_model_id=assignment_id, grade_model=Grade, attempt_model=Attempt
        )
        session["step"] = LearningSessionStep.FINAL

        return session

    async def analyze_answers(self, question_ids: Sequence[int]):
        from apps.assignment.documents import SubmissionDocument

        return await sync_to_async(SubmissionDocument.analyze_answers)(question_ids=question_ids)

    async def get_rubric_data(self) -> RubricDataDict:
        criteria_dict: dict[int, RubricCriterionDataDict] = {}
        max_points_by_criterion: dict[int, dict[str, int]] = {}

        async for criterion in self.rubric.rubric_criteria.all():
            criterion_id = criterion.pk
            criteria_dict[criterion_id] = {
                "id": criterion_id,
                "name": criterion.name,
                "description": criterion.description,
                "performance_levels": [],
            }
            max_points_by_criterion[criterion_id] = {"max_point": 0}

            async for level in criterion.performance_levels.all():
                max_points_by_criterion[criterion_id]["max_point"] = max(
                    max_points_by_criterion[criterion_id]["max_point"], level.point
                )
                criteria_dict[criterion_id]["performance_levels"].append({
                    "id": level.pk,
                    "name": level.name,
                    "description": level.description,
                    "point": level.point,
                })

        possible_point = sum(data["max_point"] for data in max_points_by_criterion.values())

        return {
            "id": self.rubric.pk,
            "name": self.rubric.name,
            "description": self.rubric.description,
            "possible_point": possible_point,
            "criteria": list(criteria_dict.values()),
        }


@pghistory.track()
class Attempt(AttemptMixin):
    assignment = ForeignKey(Assignment, CASCADE, verbose_name=_("Assignment"))
    learner = ForeignKey(User, CASCADE, verbose_name=_("Learner"), related_name="+")
    question = ForeignKey(Question, CASCADE, verbose_name=_("Question"))
    retry = PositiveSmallIntegerField(_("Retry"), default=0)

    class Meta:
        verbose_name = _("Attempt")
        verbose_name_plural = _("Attempts")
        indexes = [Index(fields=["learner_id", "active"])]
        constraints = [
            UniqueConstraint(
                fields=["assignment", "learner", "context"],
                condition=Q(active=True),
                name="assignment_attempt_as_le_co_ke_uniq",
            )
        ]

    if TYPE_CHECKING:
        learner_id: str
        question_id: int
        plagiarism_threshold: int  # annotated
        max_attempts: int  # annotated
        total_count: int  # annotated
        submission: "Submission"

    @classmethod
    async def start(cls, *, assignment_id: str, learner_id: str, lock: datetime, context: str, realm: RealmChoices):
        assignment = await Assignment.objects.aget(id=assignment_id)

        if assignment.verification_required:
            if not await OtpLog.check_otp_verification(user_id=learner_id, consumer=assignment):
                raise ValueError(ErrorCode.OTP_VERIFICATION_REQUIRED)

        question = await QuestionPool(id=assignment.question_pool_id).select_question()
        await aprefetch_related_objects([question], "attachments")

        try:
            attempt = await Attempt.objects.acreate(
                assignment=assignment,
                learner_id=learner_id,
                lock=lock,
                context=context,
                active=True,
                started=timezone.now() + timedelta(seconds=1),
                question=question,
                realm=realm,
            )
        except IntegrityError:
            raise ValueError(ErrorCode.ATTEMPT_ALREADY_STARTED)

        attempt._state.fields_cache["submission"] = None  # type: ignore

        return attempt

    @classmethod
    async def submit(
        cls, *, assignment_id: str, learner_id: str, context: str, answer: str, files: Sequence[File] | None
    ):
        attempt = (
            await cls.objects
            .select_related("assignment", "question")
            .prefetch_related(
                Prefetch(
                    "assignment__rubric__rubric_criteria__performance_levels",
                    queryset=PerformanceLevel.objects.order_by("point"),
                )
            )
            .aget(assignment_id=assignment_id, learner_id=learner_id, context=context, active=True)
        )

        file_count = attempt.question.attachment_file_count
        if file_count > 0:
            if not files or len(files) < file_count:
                raise ValueError(ErrorCode.ATTACHMENT_TOO_FEW)

        content = BeautifulSoup(answer, "html.parser").get_text(separator=" ", strip=True)
        for f in files or []:
            tika_response = parser.from_buffer(f, settings.TIKA_HOST)
            content += "\n" + (tika_response.get("content") or "").strip()  # type: ignore

        if not content:
            raise ValueError(ErrorCode.EMPTY_ANSWER)

        # pretest plagiarism
        if attempt.question.plagiarism_threshold > 0:
            from apps.assignment.documents import SubmissionDocument

            test_result = await sync_to_async(SubmissionDocument.check_similarity)(
                question_id=attempt.question_id, user_id=learner_id, text=content
            )

            similarity_percentage = test_result["similarity_percentage"]
            if similarity_percentage >= attempt.question.plagiarism_threshold:
                raise PlagiarismDetectedException(similarity_percentage)

        submission = await Submission.create(attempt=attempt, answer=answer, extracted_text=content, files=files)

        # preliminary grade
        await submission.create_preliminary_grade()

        return submission

    @classmethod
    async def deactivate(cls, *, assignment_id: str, learner_id: str, context: str):
        attempt = (
            await cls.objects
            .filter(assignment_id=assignment_id, learner_id=learner_id, context=context)
            .annotate(max_attempts=F("assignment__max_attempts"))
            .aget(active=True)
        )

        if attempt.max_attempts and attempt.max_attempts - 1 <= attempt.retry:
            raise ValueError(ErrorCode.MAX_ATTEMPTS_REACHED)

        attempt.active = False
        await attempt.asave()


setattr(Attempt._meta, "triggers", [attempt_retry_count(Attempt._meta.db_table)])


@pghistory.track()
class Submission(TimeStampedMixin, AttachmentMixin):
    attempt = OneToOneField(Attempt, CASCADE, verbose_name=_("Attempt"))
    answer = TextField(_("Answer"))
    extracted_text = TextField(_("Extracted Text"), blank=True, default="")

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Submission")
        verbose_name_plural = _("Submissions")

    if TYPE_CHECKING:
        pgh_event_model: type[Model]

    @property
    def cleaned_answer(self):
        return self.update_attachment_urls(content=self.answer)

    async def create_preliminary_grade(self):
        await Grade(attempt=self.attempt).grade()

    @classmethod
    async def create(cls, *, attempt: "Attempt", answer: str, extracted_text: str, files: Sequence[File] | None):
        submission, created = await Submission.objects.aget_or_create(
            attempt=attempt, defaults={"answer": answer, "extracted_text": extracted_text}
        )

        if not created:
            raise ValueError(ErrorCode.ATTEMPT_ALREADY_SUBMITTED)

        await submission.update_attachments(files=files, owner_id=attempt.learner_id, content=submission.answer)
        return submission


@pghistory.track()
class Grade(GradeFieldMixin, TimeStampedMixin):
    attempt = OneToOneField(Attempt, CASCADE, verbose_name=_("Attempt"))
    grader = ForeignKey(User, SET_NULL, null=True, blank=True, verbose_name=_("Grader"), related_name="+")

    class Meta(GradeFieldMixin.Meta, TimeStampedMixin.Meta):
        verbose_name = _("Grade")
        verbose_name_plural = _("Grades")

    if TYPE_CHECKING:
        pk: int
        attempt_id: int
        pgh_event_model: type[Model]
        analysis: dict[str, dict[str, int]]
        similar_answer: str | None

    async def grade(self, earned_existing: dict[str, int | None] | None = None, grader_id: str | None = None):
        rubric_data = await self.attempt.assignment.get_rubric_data()
        default_details: dict[str, int | None] = {criterion["name"]: None for criterion in rubric_data["criteria"]}
        self.earned_details = default_details | (self.earned_details or {})

        if earned_existing is not None:
            valid_keys = set(self.earned_details.keys())
            self.earned_details.update({k: v for k, v in earned_existing.items() if k in valid_keys})

        self.possible_point = rubric_data["possible_point"]
        self.earned_point = sum(filter(None, self.earned_details.values()))
        self.score = (self.earned_point * 100.0 / self.possible_point) if self.possible_point else 0
        self.passed = self.score >= (self.attempt.assignment.passing_point or 0)
        if not self.completed:
            self.completed = None if None in self.earned_details.values() else timezone.now()
        self.grader_id = grader_id
        await self.asave()

    def on_completed_changed(self, old_value: datetime | None):
        if self.completed and not self.confirmed:
            user_message_created.send(
                source=self.attempt.assignment,
                path="",
                message=MessageType(
                    user_id=self.attempt.learner_id,
                    title=t("Assignment Grading Completed"),
                    body=self.attempt.assignment.title,
                ),
            )

    def on_confirmed_changed(self, old_value: datetime | None):
        if self.confirmed:
            user_message_created.send(
                source=self.attempt.assignment,
                path="",
                message=MessageType(
                    user_id=self.attempt.learner_id,
                    title=t("Assignment Grading Confirmed"),
                    body=self.attempt.assignment.title,
                ),
            )


@pghistory.track()
class PlagiarismCheck(TimeStampedMixin):
    class StatusChoices(TextChoices):
        NOT_DETECTED = "not_detected", _("Not Detected")
        DETECTED = "detected", _("Detected")
        EXCUSED = "excused", _("Excused")
        NOT_RESOLVED = "not_resolved", _("Not Resolved")

    attempt = OneToOneField(Attempt, CASCADE, verbose_name=_("Attempt"))
    status = CharField(_("Status"), max_length=20, choices=StatusChoices.choices, db_index=True)
    similarity_percentage = FloatField(_("Similarity Percentage"))
    flagged_text = TextField(_("Flagged Text"))
    source_text = TextField(_("Source Text"))
    source_user_id = CharField(_("Source User ID"), max_length=36)
    reason = TextField(_("Reason"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Plagiarism Check")
        verbose_name_plural = _("Plagiarism Checks")


class RubricDataDict(TypedDict):
    id: int
    name: str
    description: str
    possible_point: int
    criteria: "list[RubricCriterionDataDict]"


class RubricCriterionDataDict(TypedDict):
    id: int
    name: str
    description: str
    performance_levels: "list[PerformanceLevelDataDict]"


class PerformanceLevelDataDict(TypedDict):
    id: int
    name: str
    description: str
    point: int


@pghistory.track()
class Rubric(Model):
    name = CharField(_("Name"), max_length=255, unique=True)
    description = TextField(_("Description"))

    class Meta:
        verbose_name = _("Rubric")
        verbose_name_plural = _("Rubrics")

    if TYPE_CHECKING:
        pk: int
        rubric_criteria: "QuerySet[RubricCriterion]"

    def __str__(self):
        return self.name


@pghistory.track()
class RubricCriterion(Model):
    rubric = ForeignKey(Rubric, CASCADE, related_name="rubric_criteria", verbose_name=_("Rubric"))
    name = CharField(_("Name"), max_length=255)
    description = TextField(_("Description"))

    class Meta:
        verbose_name = _("Rubric Criterion")
        verbose_name_plural = _("Rubric Criteria")
        constraints = [UniqueConstraint(fields=["rubric", "name"], name="assigment_rubriccriterion_ru_na_uniq")]

    if TYPE_CHECKING:
        pk: int
        performance_levels: "QuerySet[PerformanceLevel]"

    def __str__(self):
        return self.name


@pghistory.track()
class PerformanceLevel(Model):
    criterion = ForeignKey(RubricCriterion, CASCADE, related_name="performance_levels", verbose_name=_("Criterion"))
    name = CharField(_("Name"), max_length=255)
    description = TextField(_("Description"))
    point = PositiveSmallIntegerField(_("Point"))

    class Meta:
        verbose_name = _("Performance Level")
        verbose_name_plural = _("Performance Levels")
        constraints = [
            UniqueConstraint(fields=["criterion", "name"], name="assignment_performancelevel_cr_na_uniq"),
            UniqueConstraint(fields=["criterion", "point"], name="assignment_performancelevel_cr_po_uniq"),
        ]

    if TYPE_CHECKING:
        pk: int

    def __str__(self):
        return self.name
