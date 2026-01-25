import pytest

from apps.assistant.tests.factories import AssistantBotFactory, AssistantNoteFactory, ChatFactory


@pytest.mark.order(-3)
@pytest.mark.django_db
def test_assistant():
    bot = AssistantBotFactory.create()
    ChatFactory.create(bot=bot)
    AssistantNoteFactory.create()
