import mimesis
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from factory.declarations import Iterator, LazyAttribute, LazyFunction, Sequence, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import lazy_attribute, post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.common.tests.factories import lazy_avatar
from apps.operation.models import (
    FAQ,
    Announcement,
    Attachment,
    Comment,
    FAQItem,
    HonorCode,
    Inquiry,
    InquiryResponse,
    Instructor,
    Message,
    Policy,
    PolicyVersion,
    Thread,
)

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class AnnouncementFactory(DjangoModelFactory[Announcement]):
    title = FactoryField("sentence")
    body = LazyFunction(
        lambda: "\n\n".join([
            generic.text.text(quantity=generic.random.randint(5, 8)) for _ in range(generic.random.randint(3, 5))
        ])
    )
    public = True
    pinned = LazyFunction(lambda: generic.random.weighted_choice({True: 1, False: 9}))

    class Meta:
        model = Announcement
        django_get_or_create = ("title",)


class InstructorFactory(DjangoModelFactory[Instructor]):
    name = FactoryField("full_name", reverse=True)
    email = FactoryField("email")
    about = FactoryField("text", quantity=generic.random.randint(5, 8))
    bio = LazyFunction(lambda: [generic.text.title()[:30] for _ in range(generic.random.randint(5, 8))])
    avatar = LazyFunction(lazy_avatar)
    active = True

    class Meta:
        model = Instructor
        django_get_or_create = ("email",)


class HonorCodeFactory(DjangoModelFactory[HonorCode]):
    title = LazyFunction(lambda: f"{generic.food.fruit()} {_('Honor Code')}")
    code = LazyFunction(
        lambda: "\n\n".join([
            generic.text.text(quantity=generic.random.randint(2, 4)) for _ in range(generic.random.randint(5, 10))
        ])
    )

    class Meta:
        model = HonorCode
        django_get_or_create = ("title",)


class FAQFactory(DjangoModelFactory[FAQ]):
    name = FactoryField("text.title")
    description = FactoryField("sentence")

    class Meta:
        model = FAQ
        django_get_or_create = ("name",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        for __ in range(generic.random.randint(5, 7)):
            FAQItemFactory(faq=self)


class FAQItemFactory(DjangoModelFactory[FAQItem]):
    question = FactoryField("sentence")
    answer = FactoryField("text", quantity=generic.random.randint(3, 5))
    active = True

    class Meta:
        model = FAQItem
        django_get_or_create = ("faq", "question")


class AttachmentFactory(DjangoModelFactory[Attachment]):
    file = LazyFunction(
        lambda: ContentFile(
            generic.binaryfile.document(file_type=mimesis.DocumentFile.PDF), f"{generic.random.randint(1000, 9999)}.pdf"
        )
    )
    size = LazyAttribute(lambda o: o.file.size)
    mime_type = "application/pdf"

    class Meta:
        model = Attachment
        django_get_or_create = ("file",)
        skip_postgeneration_save = True


class InquiryFactory(DjangoModelFactory[Inquiry]):
    title = FactoryField("text.title")
    question = FactoryField("text")
    writer = SubFactory(UserFactory)
    content_id = None

    class Meta:
        model = Inquiry
        django_get_or_create = ("content_id", "title")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: Inquiry, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        if self.inquiryresponse_set.exists():
            return

        for i in range(generic.random.randint(0, 2)):
            InquiryResponseFactory.create(inquiry=self, solved=timezone.now() if (i == 2) else None)


class InquiryResponseFactory(DjangoModelFactory[InquiryResponse]):
    answer = FactoryField("text")
    writer = SubFactory(UserFactory)
    solved = None

    class Meta:
        model = InquiryResponse


class MessageFactory(DjangoModelFactory[Message]):
    user = SubFactory(UserFactory)
    title = LazyFunction(lambda: generic.text.title())
    body = LazyFunction(lambda: generic.text.text())
    data = {"app_label": "", "model": "", "object_id": "", "path": ""}

    class Meta:
        model = Message


class PolicyFactory(DjangoModelFactory[Policy]):
    kind = Iterator(Policy.KindChoices)
    title = Iterator([choice[1] for choice in Policy.KindChoices.choices])
    description = FactoryField("text")
    active = True
    mandatory = True

    class Meta:
        model = Policy
        django_get_or_create = ("kind",)
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        PolicyVersionFactory.reset_sequence()
        PolicyVersionFactory.create_batch(generic.random.randint(1, 3), policy=self)


class PolicyVersionFactory(DjangoModelFactory[PolicyVersion]):
    body = LazyFunction(
        lambda: "\n\n".join([
            generic.text.text(quantity=generic.random.randint(1, 3)) for _ in range(generic.random.randint(10, 20))
        ])
    )
    version = Sequence(lambda n: f"{n + 1}.0.0")
    effective_date = LazyFunction(lambda: timezone.now())

    class Meta:
        model = PolicyVersion
        django_get_or_create = ("policy", "version")

    @lazy_attribute
    def data_category(self):
        return {"privacy": generic.text.words(quantity=generic.random.randint(3, 5))}


generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class ThreadFactory(DjangoModelFactory[Thread]):
    title = FactoryField("text.title")
    description = FactoryField("text", quantity=generic.random.randint(1, 3))

    class Meta:
        model = Thread
        django_get_or_create = ("subject_type", "subject_id")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        comments = CommentFactory.create_batch(generic.random.randint(5, 20), thread=self)
        for comment in comments:
            if generic.random.randint(1, 5) == 1:
                CommentFactory.create_batch(generic.random.randint(1, 5), thread=self, parent=comment)


class CommentFactory(DjangoModelFactory[Comment]):
    comment = FactoryField("text", quantity=generic.random.randint(2, 10))
    pinned = LazyFunction(lambda: generic.random.weighted_choice({True: 1, False: 9}))
    deleted = LazyFunction(lambda: generic.random.weighted_choice({True: 1, False: 9}))
    rating = LazyFunction(lambda: generic.random.randint(1, 5))
    writer = SubFactory(UserFactory)

    class Meta:
        model = Comment
