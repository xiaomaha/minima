import json

import pytest
from django.test.client import Client

from apps.exam.models import Attempt
from apps.exam.tests.factories import ExamFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_exam_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    exam = ExamFactory(owner=admin_user.get_user())
    exam_id = exam.id

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=exam")
    assert res.status_code == 200, "get content suggestions"

    # get exam
    res = client.get(f"/api/v1/studio/exam/{exam_id}")
    assert res.status_code == 200, "get exam"

    data = res.json()
    questions = data["questions"][:3]
    del data["questions"]

    # save exam
    res = client.post("/api/v1/studio/exam", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save exam"

    data["id"] = ""
    data["title"] += "unique"

    # create new exam
    res = client.post("/api/v1/studio/exam", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new exam"

    # get exam questions
    res = client.get(f"/api/v1/studio/exam/{exam_id}/question")
    assert res.status_code == 200, "get exam questions"

    for question in questions:
        del question["id"]

    # save exam questions
    res = client.post(
        f"/api/v1/studio/exam/{exam_id}/question", data={"data": json.dumps({"data": questions})}, format="multipart"
    )
    assert res.status_code == 200, "save exam questions"

    # delete exam question
    res = client.delete(f"/api/v1/studio/exam/{exam_id}/question/{res.json()[0]}")
    assert res.status_code == 200, "delete exam question"

    # delete exam
    Attempt.objects.filter(exam_id=exam_id).delete()
    res = client.delete(f"/api/v1/studio/exam/{exam_id}")
    assert res.status_code == 200, "delete exam"
