import pytest

from apps.quiz.tests.factories import QuizFactory


@pytest.mark.django_db
def test_quiz():
    QuizFactory.create()
