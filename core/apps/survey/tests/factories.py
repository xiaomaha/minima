import mimesis
from django.conf import settings
from django.utils import timezone
from factory.declarations import Iterator, LazyFunction, Sequence, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import lazy_attribute, post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.common.tests.factories import LearningObjectFactory, dummy_html
from apps.survey.models import Question, QuestionPool, Submission, Survey
from conftest import test_user_email

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class QuestionPoolFactory(DjangoModelFactory[QuestionPool]):
    title = FactoryField("text.title")
    description = FactoryField("text")
    owner = SubFactory(UserFactory)

    class Meta:
        model = QuestionPool
        django_get_or_create = ("title",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: QuestionPool, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        if self.questions.exists():
            return

        QuestionFactory.reset_sequence()
        QuestionFactory.create_batch(10, pool=self, format=Question.SurveyQuestionFormatChoices.SINGLE_CHOICE.value)
        QuestionFactory.create_batch(3, pool=self, format=Question.SurveyQuestionFormatChoices.TEXT_INPUT.value)
        QuestionFactory.create_batch(2, pool=self, format=Question.SurveyQuestionFormatChoices.NUMBER_INPUT.value)


class QuestionFactory(DjangoModelFactory[Question]):
    ordering = Sequence(lambda n: n)
    pool = SubFactory(QuestionPoolFactory)
    format = Iterator(Question.SurveyQuestionFormatChoices)
    question = Sequence(lambda n: f"{generic.text.text(quantity=generic.random.randint(1, 3))} {n}")
    supplement = LazyFunction(lambda: dummy_html() if generic.random.randint(1, 5) == 1 else "")
    mandatory = FactoryField("random.weighted_choice", choices={True: 9, False: 1})

    class Meta:
        model = Question

    @lazy_attribute
    def options(self) -> list[str]:
        if self.format == Question.SurveyQuestionFormatChoices.SINGLE_CHOICE.value:
            return [generic.text.text(quantity=generic.random.randint(1, 3)) for _ in range(5)]
        return []


class SurveyFactory(LearningObjectFactory[Survey]):
    passing_point = 0
    max_attempts = 0
    verification_required = False

    owner = LazyFunction(lambda: UserFactory(email=test_user_email))
    question_pool = SubFactory(QuestionPoolFactory, owner=owner)
    complete_message = FactoryField("text")
    anonymous = Iterator([True, False])
    show_results = Iterator([True, False])

    class Meta:
        model = Survey
        django_get_or_create = ("title",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return
        if self.anonymous:
            SubmissionFactory.create_batch(10, survey=self, respondent=None)
        else:
            SubmissionFactory.create_batch(10, survey=self)


class SubmissionFactory(DjangoModelFactory[Submission]):
    survey = SubFactory(SurveyFactory)
    respondent = SubFactory(UserFactory)
    lock = LazyFunction(timezone.now)
    active = True
    context = ""

    class Meta:
        model = Submission
        django_get_or_create = ("survey", "respondent", "context", "active")

    @lazy_attribute
    def answers(self: Submission):
        answer_dict = {}
        for q in self.survey.question_pool.questions.all():
            if q.format == Question.SurveyQuestionFormatChoices.SINGLE_CHOICE.value:
                answer = generic.random.randint(1, len(q.options))
            elif q.format == Question.SurveyQuestionFormatChoices.TEXT_INPUT.value:
                answer = generic.text.word()
            elif q.format == Question.SurveyQuestionFormatChoices.NUMBER_INPUT.value:
                answer = generic.random.randint(1, 10)
            else:
                raise ValueError(f"Invalid survey question format: {q.format}")

            answer_dict[str(q.pk)] = str(answer)

        return answer_dict
