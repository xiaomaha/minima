import json

import pytest
from django.test.client import Client

from apps.quiz.tests.factories import QuizFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_quiz_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    QuizFactory(owner=admin_user.get_user())

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=quiz")
    assert res.status_code == 200, "get content suggestions"

    quiz_id = res.json()[0]["id"]

    # get quiz
    res = client.get(f"/api/v1/studio/quiz/{quiz_id}")
    assert res.status_code == 200, "get quiz"

    data = res.json()
    question_set = data["questionSet"][:3]
    del data["questionSet"]

    # save quiz
    res = client.post("/api/v1/studio/quiz", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save quiz"

    data["id"] = ""
    data["title"] += "unique"

    # create new quiz
    res = client.post("/api/v1/studio/quiz", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new quiz"

    question = question_set[0]
    question["id"] = 0

    # save quiz question
    res = client.post(
        f"/api/v1/studio/quiz/{quiz_id}/question", data={"data": json.dumps(question)}, format="multipart"
    )
    assert res.status_code == 200, "save quiz question"

    # delete quiz question
    res = client.delete(f"/api/v1/studio/quiz/{quiz_id}/question/{res.json()}")
    assert res.status_code == 200, "delete quiz question"

    for question in question_set:
        question["question"] += "1"

    # save quiz questions
    res = client.post(
        f"/api/v1/studio/quiz/{quiz_id}/questionset",
        data={"data": json.dumps({"data": question_set})},
        format="multipart",
    )
    assert res.status_code == 200, "save quiz questions"
