import json

import pytest
from django.test.client import Client

from apps.quiz.models import Attempt
from apps.quiz.tests.factories import QuizFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_quiz_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    quiz = QuizFactory(owner=admin_user.get_user())
    Attempt.objects.filter(quiz=quiz).delete()

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=quiz")
    assert res.status_code == 200, "get content suggestions"

    quiz_id = res.json()[0]["id"]

    # get quiz
    res = client.get(f"/api/v1/studio/quiz/{quiz_id}")
    assert res.status_code == 200, "get quiz"

    data = res.json()
    questions = data["questions"]
    del data["questions"]

    # save quiz
    res = client.post("/api/v1/studio/quiz", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save quiz"

    data["id"] = ""
    data["title"] += "unique"

    # create new quiz
    res = client.post("/api/v1/studio/quiz", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new quiz"

    # get quiz questions
    res = client.get(f"/api/v1/studio/quiz/{quiz_id}/question")
    assert res.status_code == 200, "get quiz questions"

    for question in questions:
        del question["id"]

    # save quiz questions
    res = client.post(
        f"/api/v1/studio/quiz/{quiz_id}/question", data={"data": json.dumps({"data": questions})}, format="multipart"
    )
    assert res.status_code == 200, "save quiz questions"

    # delete quiz question
    res = client.delete(f"/api/v1/studio/quiz/{quiz_id}/question/{res.json()[0]}")
    assert res.status_code == 200, "delete quiz question"
