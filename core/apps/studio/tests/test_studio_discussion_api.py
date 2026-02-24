import json

import pytest
from django.test.client import Client

from apps.discussion.tests.factories import DiscussionFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_discussion_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    DiscussionFactory(owner=admin_user.get_user())

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=discussion")
    assert res.status_code == 200, "get content suggestions"

    discussion_id = res.json()[0]["id"]

    # get discussion
    res = client.get(f"/api/v1/studio/discussion/{discussion_id}")
    assert res.status_code == 200, "get discussion"

    data = res.json()
    question_set = data["questionSet"][:3]
    del data["questionSet"]

    # save discussion
    res = client.post("/api/v1/studio/discussion", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save discussion"

    data["id"] = ""
    data["title"] += "unique"

    # create new discussion
    res = client.post("/api/v1/studio/discussion", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new discussion"

    question = question_set[0]
    question["id"] = 0

    # save discussion question
    res = client.post(
        f"/api/v1/studio/discussion/{discussion_id}/question", data={"data": json.dumps(question)}, format="multipart"
    )
    assert res.status_code == 200, "save discussion question"

    # delete discussion question
    res = client.delete(f"/api/v1/studio/discussion/{discussion_id}/question/{res.json()}")
    assert res.status_code == 200, "delete discussion question"
