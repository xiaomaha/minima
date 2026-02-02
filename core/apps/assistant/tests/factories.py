import mimesis
from django.conf import settings
from django.utils import timezone
from factory.declarations import LazyFunction, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import lazy_attribute, post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.assistant.models import AssistantNote, Chat, ChatMessage

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class AssistantNoteFactory(DjangoModelFactory[AssistantNote]):
    user = SubFactory(UserFactory)

    class Meta:
        model = AssistantNote
        django_get_or_create = ("user",)
        skip_postgeneration_save = True

    @lazy_attribute
    def note(self):
        learning_styles = ["visual", "auditory", "kinesthetic", "reading_writing"]

        return f"""
learning_style: {generic.random.choice(learning_styles)}
preferred_language: {generic.random.choice([lang[0] for lang in settings.LANGUAGES])}
strengths: {[generic.text.word() for _ in range(generic.random.randint(1, 3))]}
weaknesses: {[generic.text.word() for _ in range(generic.random.randint(1, 3))]}
goals: {[generic.text.sentence() for _ in range(generic.random.randint(1, 3))]}
notes: {generic.text.text(quantity=generic.random.randint(1, 2))}
"""


class ChatFactory(DjangoModelFactory[Chat]):
    user = SubFactory(UserFactory)
    title = LazyFunction(lambda: generic.text.text()[:50])
    active = True

    class Meta:
        model = Chat
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        message_count = generic.random.randint(3, 15)
        ChatMessageFactory.create_batch(message_count, chat=self)


class ChatMessageFactory(DjangoModelFactory[ChatMessage]):
    chat = SubFactory(ChatFactory)
    completed = LazyFunction(lambda: timezone.now() if generic.random.randint(1, 10) > 1 else None)
    bookmarked = FactoryField("random.weighted_choice", choices={True: 1, False: 10})

    @lazy_attribute
    def path(self):
        patterns = ["/course/", "/assignment/", "/exam/", "/content/media/", "/discussion/thread/"]
        pattern = generic.random.choice(patterns)
        return f"{pattern}{generic.cryptographic.uuid()[:12]}"

    class Meta:
        model = ChatMessage
        skip_postgeneration_save = True

    @lazy_attribute
    def message(self):
        return generic.text.sentence()

    @lazy_attribute
    def response(self):
        if generic.random.randint(1, 3) == 1:
            return f"{generic.text.text(quantity=2)}\n\n{generic.text.text(quantity=1)}"
        else:
            sentences = [generic.text.sentence() for _ in range(generic.random.randint(1, 4))]
            return "\n\n".join(sentences)

    @lazy_attribute
    def rating(self):
        if self.completed:
            return generic.random.choice([None, 1, 2, 3, 4, 5])
        return None

    @lazy_attribute
    def input_tokens(self: ChatMessage):
        if self.completed:
            message_length = len(self.message)
            return int(message_length / 4)
        return None

    @lazy_attribute
    def output_tokens(self: ChatMessage):
        if self.completed:
            response_length = len(self.response)
            return int(response_length / 4)
        return None
