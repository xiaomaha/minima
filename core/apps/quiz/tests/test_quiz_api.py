import json

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis.providers.generic import Generic

from apps.learning.tests.factories import EnrollmentFactory
from apps.quiz.models import Quiz
from apps.quiz.tests.factories import QuizFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_quiz_flow(client: Client, mimesis: Generic, admin_user: AdminUser):
    admin_user.login()

    quiz: Quiz = QuizFactory(max_attempts=2)
    EnrollmentFactory(
        content_type=ContentType.objects.get_for_model(quiz), content_id=quiz.id, active=True, user_id=admin_user.id
    )

    # get quiz session
    res = client.get(f"/api/v1/quiz/{quiz.id}/session")
    assert res.status_code == 200, "get quiz session"

    # start new quiz attempt
    res = client.post(f"/api/v1/quiz/{quiz.id}/attempt")
    assert res.status_code == 200, "start new quiz attempt"

    answers: dict[str, str] = {}

    for question in res.json()["questions"]:
        answers[str(question["id"])] = mimesis.random.choice(question["options"])

    # submit quiz
    res = client.post(
        f"/api/v1/quiz/{quiz.id}/attempt/submit", data=json.dumps(answers), content_type="application/json"
    )
    assert res.status_code == 200, "submit quiz"

    # deactivate attempt
    res = client.delete(f"/api/v1/quiz/{quiz.id}/attempt/deactivate")
    assert res.status_code == 200, "deactivate attempt"
