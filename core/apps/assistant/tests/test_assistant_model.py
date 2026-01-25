import pytest

from apps.assistant.tests.factories import AssistantNoteFactory, ChatFactory


@pytest.mark.order(-3)
@pytest.mark.django_db
def test_assistant():
    ChatFactory.create()
    AssistantNoteFactory.create()
