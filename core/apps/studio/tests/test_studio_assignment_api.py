import json

import pytest
from django.test.client import Client

from apps.assignment.tests.factories import AssignmentFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_assignment_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    AssignmentFactory(owner=admin_user.get_user())

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=assignment")
    assert res.status_code == 200, "get content suggestions"

    assignment_id = res.json()[0]["id"]

    # get assignment
    res = client.get(f"/api/v1/studio/assignment/{assignment_id}")
    assert res.status_code == 200, "get assignment"

    data = res.json()
    questions = data["questions"][:3]
    del data["questions"]

    # save assignment
    res = client.post("/api/v1/studio/assignment", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save assignment"

    data["id"] = ""
    data["title"] += "unique"

    # create new assignment
    res = client.post("/api/v1/studio/assignment", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new assignment"

    question = questions[0]
    question["id"] = 0

    # save assignment question
    res = client.post(
        f"/api/v1/studio/assignment/{assignment_id}/question", data={"data": json.dumps(question)}, format="multipart"
    )
    assert res.status_code == 200, "save assignment question"

    # delete assignment question
    res = client.delete(f"/api/v1/studio/assignment/{assignment_id}/question/{res.json()}")
    assert res.status_code == 200, "delete assignment question"
