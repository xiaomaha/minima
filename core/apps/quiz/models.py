import random
from datetime import timedelta
from typing import TYPE_CHECKING, NotRequired, Sequence, TypedDict

import pghistory
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.core.files import File
from django.db import IntegrityError
from django.db.models import (
    CASCADE,
    BooleanField,
    CharField,
    DateTimeField,
    F,
    ForeignKey,
    JSONField,
    ManyToManyField,
    Model,
    OneToOneField,
    PositiveSmallIntegerField,
    Prefetch,
    Q,
    QuerySet,
    TextField,
    UniqueConstraint,
)
from django.utils import timezone
from django.utils.translation import get_language_info
from django.utils.translation import gettext_lazy as _

from apps.assistant.plugin.quiz import QuizMaker
from apps.common.error import ErrorCode
from apps.common.models import GradeFieldMixin, GradeWorkflowMixin, LearningObjectMixin, TimeStampedMixin
from apps.common.util import AccessDate, LearningSessionStep, ScoreStatsDict, get_score_stats
from apps.quiz.trigger import attempt_retry_count

User = get_user_model()


class QuestionData(TypedDict):
    question: str
    options: list[str]
    correct_answer: int
    explanation: str
    supplement: NotRequired[str]
    point: NotRequired[int]


class QuizData(TypedDict):
    questions: list[QuestionData]


class SessionDict(TypedDict):
    access_date: AccessDate
    step: LearningSessionStep
    quiz: "Quiz"
    attempt: NotRequired["Attempt"]
    submission: NotRequired["Submission"]
    grade: NotRequired["Grade"]
    solutions: NotRequired[dict[str, Solution]]
    analysis: NotRequired[dict[str, dict[str, int]]]
    stats: NotRequired[ScoreStatsDict]


QUIZ_SELECT_COUNT = 10


@pghistory.track()
class QuestionPool(Model):
    title = CharField(_("Title"), max_length=255)
    description = TextField(_("Description"), default="", blank=True)
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"), related_name="+")
    select_count = PositiveSmallIntegerField(_("Select Count"))

    class Meta:
        verbose_name = _("Question Pool")
        verbose_name_plural = _("Question Pools")
        constraints = [UniqueConstraint(fields=["title", "owner"], name="quiz_questionpool_ti_ow_uniq")]

    if TYPE_CHECKING:
        question_set: "QuerySet[Question]"

    async def select_questions(self):
        all_question_ids = [q async for q in self.question_set.values_list("id", flat=True)]
        random.shuffle(all_question_ids)
        question_ids = all_question_ids[: self.select_count]
        return Question.objects.filter(id__in=question_ids)


@pghistory.track()
class Question(Model):
    pool = ForeignKey(QuestionPool, CASCADE, verbose_name=_("Question Pool"))
    question = TextField(_("Question"))
    supplement = TextField(_("Supplement"), blank=True, default="")
    options = ArrayField(TextField(), verbose_name=_("Options"))
    point = PositiveSmallIntegerField(_("Point"), default=1)

    class Meta:
        verbose_name = _("Question")
        verbose_name_plural = _("Questions")

    if TYPE_CHECKING:
        pk: int
        solution: "Solution"


@pghistory.track()
class Solution(Model):
    question = OneToOneField(Question, CASCADE, verbose_name=_("Question"))
    correct_answers = ArrayField(CharField(max_length=50), blank=True, default=list, verbose_name=_("Correct Answers"))
    explanation = TextField(_("Explanation"), blank=True, default="")

    class Meta:
        verbose_name = _("Solution")
        verbose_name_plural = _("Solutions")


@pghistory.track()
class Quiz(LearningObjectMixin):
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    question_pool = ForeignKey(QuestionPool, CASCADE, verbose_name=_("Question Pool"))

    class Meta(LearningObjectMixin.Meta, GradeWorkflowMixin.Meta):
        verbose_name = _("Quiz")
        verbose_name_plural = _("Quizzes")
        constraints = [UniqueConstraint(fields=["owner", "title"], name="quiz_quiz_ow_ti_uniq")]

    @classmethod
    async def get_session(cls, *, quiz_id: str, learner_id: str, context: str, access_date: AccessDate):
        quiz = await Quiz.objects.select_related("owner", "question_pool").aget(id=quiz_id)
        session = SessionDict(access_date=access_date, step=LearningSessionStep.READY, quiz=quiz)

        attempt = (
            await Attempt.objects
            .filter(quiz=quiz, learner_id=learner_id, context=context, active=True)
            .select_related("quiz", "submission", "grade")
            .prefetch_related(
                Prefetch("questions", queryset=Question.objects.select_related("solution").order_by("id"))
            )
            .alast()
        )

        if not attempt:
            return session

        session["attempt"] = attempt

        if not hasattr(attempt, "submission"):
            session["step"] = LearningSessionStep.SITTING
            return session

        session["submission"] = attempt.submission
        session["grade"] = attempt.grade
        session["solutions"] = {str(q.pk): q.solution async for q in attempt.questions.all()}
        session["analysis"] = await quiz.analyze_answers([q.pk for q in attempt.questions.all()])
        session["stats"] = await get_score_stats(
            base_model=Quiz, base_model_id=quiz_id, grade_model=Grade, attempt_model=Attempt
        )
        session["step"] = LearningSessionStep.FINAL

        return session

    async def analyze_answers(self, question_ids: Sequence[int]):
        from apps.quiz.documents import SubmissionDocument

        return await sync_to_async(SubmissionDocument.analyze_answers)(question_ids=question_ids)

    @classmethod
    async def create_quiz_set(
        cls,
        *,
        title: str,
        description: str,
        audience: str,
        thumbnail: File,
        owner_id: str,
        text: str,
        question_count: int,
        lang_code: str,
    ):
        quiz_data = await QuizMaker().create_quiz_from_text(
            text=text,
            title=title,
            description=description,
            question_count=question_count,
            language=get_language_info(lang_code)["name"],
        )

        # question pool
        pool = await QuestionPool.objects.acreate(
            title=title, owner_id=owner_id, select_count=min(len(quiz_data["questions"]), QUIZ_SELECT_COUNT)
        )

        # questions
        questions = [
            Question(
                pool=pool,
                question=question_data["question"],
                supplement=question_data.get("supplement") or "",
                options=question_data["options"],
                point=question_data.get("point") or 1,
            )
            for question_data in quiz_data["questions"]
        ]
        questions = await Question.objects.abulk_create(questions)

        # solutions
        solutions = [
            Solution(
                question=question,
                correct_answers=[str(question_data["correct_answer"] + 1)],
                explanation=question_data["explanation"],
            )
            for question, question_data in zip(questions, quiz_data["questions"])
        ]
        await Solution.objects.abulk_create(solutions)

        # quiz
        return await Quiz.objects.acreate(
            owner_id=owner_id,
            question_pool=pool,
            title=title,
            description=description,
            audience=audience,
            thumbnail=thumbnail,
        )


@pghistory.track()
class Attempt(TimeStampedMixin):
    quiz = ForeignKey(Quiz, CASCADE, verbose_name=_("Quiz"))
    learner = ForeignKey(User, CASCADE, verbose_name=_("Learner"), related_name="+")
    started = DateTimeField(_("Attempt Start"))
    questions = ManyToManyField(Question, verbose_name=_("Questions"))
    active = BooleanField(_("Active"), default=True)
    context = CharField(_("Context Key"), max_length=255, blank=True, default="")
    retry = PositiveSmallIntegerField(_("Retry"), default=0)

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Attempt")
        verbose_name_plural = _("Attempts")
        constraints = [
            UniqueConstraint(
                fields=["quiz", "learner", "context"], condition=Q(active=True), name="quiz_attemp_qu_le_co_ke_uniq"
            )
        ]

    if TYPE_CHECKING:
        learner_id: str
        submission: "Submission"
        max_attempts: int  # annotated
        grade: Grade
        _prefetched_objects_cache: dict[str, QuerySet[Question]]

    @classmethod
    async def start(cls, *, quiz_id: str, learner_id: str, context: str):
        quiz = await Quiz.objects.prefetch_related("question_pool__question_set").aget(id=quiz_id)
        questions = await quiz.question_pool.select_questions()

        try:
            attempt = await Attempt.objects.acreate(
                quiz=quiz,
                learner_id=learner_id,
                context=context,
                active=True,
                started=timezone.now() + timedelta(seconds=1),
            )
        except IntegrityError:
            raise ValueError(ErrorCode.ATTEMPT_ALREADY_STARTED)

        await attempt.questions.aset(questions)

        attempt._prefetched_objects_cache = {"questions": questions}
        attempt._state.fields_cache["submission"] = None  # type: ignore

        return attempt

    @classmethod
    async def submit(cls, *, quiz_id: str, learner_id: str, context: str, answers: dict, access_date: AccessDate):
        if not answers:
            raise ValueError(ErrorCode.NO_ANSWERS)

        attempt = (
            await cls.objects
            .select_related("quiz__owner", "quiz__question_pool")
            .prefetch_related(
                Prefetch("questions", queryset=Question.objects.select_related("solution").order_by("id"))
            )
            .aget(quiz_id=quiz_id, learner_id=learner_id, context=context, active=True)
        )

        try:
            submission = await Submission.objects.acreate(attempt=attempt, answers=answers)
        except IntegrityError:
            raise ValueError(ErrorCode.ATTEMPT_ALREADY_SUBMITTED)

        grade = Grade(attempt=attempt)
        await grade.grade()

        session = SessionDict(
            access_date=access_date,
            step=LearningSessionStep.FINAL,
            quiz=attempt.quiz,
            attempt=attempt,
            submission=submission,
            grade=grade,
            solutions={str(q.pk): q.solution async for q in attempt.questions.all()},
            analysis=await attempt.quiz.analyze_answers([q.pk for q in attempt.questions.all()]),
            stats=await get_score_stats(
                base_model=Quiz, base_model_id=quiz_id, grade_model=Grade, attempt_model=Attempt
            ),
        )

        return session

    @classmethod
    async def deactivate(cls, *, quiz_id: str, learner_id: str, context: str):
        attempt = (
            await cls.objects
            .filter(quiz_id=quiz_id, learner_id=learner_id, context=context)
            .annotate(max_attempts=F("quiz__max_attempts"))
            .aget(active=True)
        )

        if attempt.max_attempts and attempt.max_attempts - 1 <= attempt.retry:
            raise ValueError(ErrorCode.MAX_ATTEMPTS_REACHED)

        attempt.active = False
        await attempt.asave()


setattr(Attempt._meta, "triggers", [attempt_retry_count(Attempt._meta.db_table)])


@pghistory.track()
class Submission(TimeStampedMixin):
    attempt = OneToOneField(Attempt, CASCADE, verbose_name=_("Attempt"))
    answers = JSONField(_("Answers"))

    class Meta(TimeStampedMixin.Meta):
        verbose_name = _("Submission")
        verbose_name_plural = _("Submissions")


@pghistory.track()
class Grade(GradeFieldMixin, TimeStampedMixin):
    attempt = OneToOneField(Attempt, CASCADE, verbose_name=_("Attempt"))

    class Meta(GradeFieldMixin.Meta, TimeStampedMixin.Meta):
        verbose_name = _("Grade")
        verbose_name_plural = _("Grades")

    if TYPE_CHECKING:
        pk: int
        attempt_id: int

    async def grade(self):
        questions = [q async for q in self.attempt.questions.all()]
        if not questions:
            raise ValueError("No question found")

        correct_answer_dict: dict[str, list[str]] = {}
        point_dict: dict[str, int] = {}

        if not self.earned_details:
            self.earned_details = {}

        for q in questions:
            if q.solution.correct_answers:
                correct_answer_dict[str(q.pk)] = q.solution.correct_answers
            point_dict[str(q.pk)] = q.point

        for q_id_str, answer in self.attempt.submission.answers.items():
            if q_id_str in correct_answer_dict:
                is_correct = answer in correct_answer_dict[q_id_str]
                self.earned_details[q_id_str] = point_dict[q_id_str] if is_correct else 0
            else:
                self.earned_details.setdefault(q_id_str, None)

        self.possible_point = sum(point_dict.values())
        self.earned_point = sum(filter(None, self.earned_details.values()))
        self.score = self.earned_point * 100.0 / self.possible_point if self.possible_point else 0.0
        self.passed = self.score >= (self.attempt.quiz.passing_point or 0)
        self.completed = timezone.now()
        self.confirmed = self.completed
        await self.asave()
