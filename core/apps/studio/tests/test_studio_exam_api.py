import json

import pytest
from django.test.client import Client

from apps.exam.tests.factories import ExamFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_exam_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    ExamFactory(owner=admin_user.get_user())

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=exam")
    assert res.status_code == 200, "get content suggestions"

    exam_id = res.json()[0]["id"]

    # get exam
    res = client.get(f"/api/v1/studio/exam/{exam_id}")
    assert res.status_code == 200, "get exam"

    data = res.json()
    question_set = data["questionSet"][:3]
    del data["questionSet"]

    # save exam
    res = client.post("/api/v1/studio/exam", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save exam"

    data["id"] = ""
    data["title"] += "unique"

    # create new exam
    res = client.post("/api/v1/studio/exam", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new exam"

    question = question_set[0]
    question["id"] = 0

    # save exam question
    res = client.post(
        f"/api/v1/studio/exam/{exam_id}/question", data={"data": json.dumps(question)}, format="multipart"
    )
    assert res.status_code == 200, "save exam question"

    # delete exam question
    res = client.delete(f"/api/v1/studio/exam/{exam_id}/question/{res.json()}")
    assert res.status_code == 200, "delete exam question"

    for question in question_set:
        question["question"] += "1"

    # save exam questions
    res = client.post(
        f"/api/v1/studio/exam/{exam_id}/questionset",
        data={"data": json.dumps({"data": question_set})},
        format="multipart",
    )
    assert res.status_code == 200, "save exam questions"
