import itertools
from datetime import timedelta

import mimesis
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.db.models import Model
from django.utils import timezone
from factory.declarations import Iterator, LazyAttribute, LazyFunction, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import lazy_attribute, post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.assignment.models import Assignment
from apps.assignment.tests.factories import AssignmentFactory
from apps.common.tests.factories import lazy_thumbnail
from apps.content.models import Media
from apps.content.tests.factories import MediaFactory
from apps.course.models import Course
from apps.course.tests.factories import CourseFactory
from apps.discussion.models import Discussion
from apps.discussion.tests.factories import DiscussionFactory
from apps.exam.models import Exam
from apps.exam.tests.factories import ExamFactory
from apps.learning.models import ENROLLABLE_MODELS, Catalog, CatalogItem, CohortCatalog, Enrollment, UserCatalog
from apps.partner.tests.factories import CohortFactory
from apps.quiz.models import Quiz
from apps.quiz.tests.factories import QuizFactory
from apps.survey.models import Survey
from apps.survey.tests.factories import SurveyFactory

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)

ENROLLABLE_FACTORY_MAP: dict[type[Model], type[DjangoModelFactory]] = {
    Course: CourseFactory,
    Media: MediaFactory,
    Exam: ExamFactory,
    Assignment: AssignmentFactory,
    Discussion: DiscussionFactory,
    Survey: SurveyFactory,
    Quiz: QuizFactory,
}


CONTENT_TYPE_MODEL_CYCLE = itertools.cycle(ENROLLABLE_MODELS)


class EnrollmentFactory(DjangoModelFactory[Enrollment]):
    user = SubFactory(UserFactory)
    active = True
    start = LazyFunction(timezone.now)
    end = LazyAttribute(lambda o: o.start + timedelta(days=30))
    archive = LazyAttribute(lambda o: o.end + timedelta(days=60))
    enrolled = LazyFunction(timezone.now)

    class Meta:
        model = Enrollment
        django_get_or_create = ("user", "content_type", "content_id")

    @lazy_attribute
    def content_type(self):
        M = next(CONTENT_TYPE_MODEL_CYCLE)
        return ContentType.objects.get_for_model(M)

    @lazy_attribute
    def content_id(self: Enrollment):
        ContentClass = self.content_type.model_class()
        if not ContentClass:
            raise ImproperlyConfigured("No content class found for content type")

        FactoryClass = ENROLLABLE_FACTORY_MAP[ContentClass]
        instance = FactoryClass.create()

        return instance.pk


class CatalogFactory(DjangoModelFactory[Catalog]):
    name = FactoryField("text.title")
    description = FactoryField("text")
    thumbnail = LazyFunction(lazy_thumbnail)
    active = True
    public = Iterator([True, False])
    available_from = LazyFunction(lambda: timezone.now())
    available_until = LazyAttribute(lambda o: o.available_from + timedelta(days=90))

    class Meta:
        model = Catalog
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create or extracted is False:
            return

        CatalogItemFactory.create_batch(size=7, catalog=self)


class CatalogItemFactory(DjangoModelFactory[CatalogItem]):
    catalog = SubFactory(CatalogFactory)

    class Meta:
        model = CatalogItem
        django_get_or_create = ("catalog", "content_type", "content_id")
        skip_postgeneration_save = True

    @lazy_attribute
    def content_type(self):
        M = next(CONTENT_TYPE_MODEL_CYCLE)
        return ContentType.objects.get_for_model(M)

    @lazy_attribute
    def content_id(self: CatalogItem):
        ContentClass = self.content_type.model_class()
        if not ContentClass:
            raise ImproperlyConfigured("No content class found for content type")

        FactoryClass = ENROLLABLE_FACTORY_MAP[ContentClass]
        instance = FactoryClass.create()

        return instance.pk


class UserCatalogFactory(DjangoModelFactory[UserCatalog]):
    user = SubFactory(UserFactory)
    catalog = SubFactory(CatalogFactory)
    granted_by = SubFactory(UserFactory)
    note = FactoryField("text", quantity=generic.random.randint(1, 3))

    class Meta:
        model = UserCatalog
        django_get_or_create = ("user", "catalog")


class CohortCatalogFactory(DjangoModelFactory[CohortCatalog]):
    cohort = SubFactory(CohortFactory)
    catalog = SubFactory(CatalogFactory)
    granted_by = SubFactory(UserFactory)
    note = FactoryField("text", quantity=generic.random.randint(1, 3))

    class Meta:
        model = CohortCatalog
        django_get_or_create = ("cohort", "catalog")
