import json

import pytest
from django.test.client import Client

from apps.assignment.models import Attempt
from apps.assignment.tests.factories import AssignmentFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_assignment_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    assignment = AssignmentFactory(owner=admin_user.get_user(), published=None)
    assignment_id = assignment.id

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=assignment")
    assert res.status_code == 200, "get content suggestions"

    # get assignment
    res = client.get(f"/api/v1/studio/assignment/{assignment_id}")
    assert res.status_code == 200, "get assignment"

    data = res.json()
    questions = data["questions"][:3]
    del data["questions"]
    rubric_criteria = data["rubricCriteria"]
    del data["rubricCriteria"]

    # save assignment
    res = client.post("/api/v1/studio/assignment", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save assignment"

    data["id"] = ""
    data["title"] += "unique"

    # create new assignment
    res = client.post("/api/v1/studio/assignment", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new assignment"

    # get assignment questions
    res = client.get(f"/api/v1/studio/assignment/{assignment_id}/question")
    assert res.status_code == 200, "get assignment questions"

    for question in questions:
        del question["id"]

    # save assignment questions
    res = client.post(
        f"/api/v1/studio/assignment/{assignment_id}/question",
        data={"data": json.dumps({"data": questions})},
        format="multipart",
    )
    assert res.status_code == 200, "save assignment questions"

    # delete assignment question
    res = client.delete(f"/api/v1/studio/assignment/{assignment_id}/question/{res.json()[0]}")
    assert res.status_code == 200, "delete assignment question"

    # get assignment rubric criteria
    res = client.get(f"/api/v1/studio/assignment/{assignment_id}/rubric")
    assert res.status_code == 200, "get assignment rubric criteria"

    # save rubric criteria
    res = client.post(
        f"/api/v1/studio/assignment/{assignment_id}/rubric",
        data=json.dumps(rubric_criteria),
        content_type="application/json",
    )
    assert res.status_code == 200, "save rubric criteria"

    # delete assignment
    Attempt.objects.filter(assignment_id=assignment_id).delete()
    res = client.delete(f"/api/v1/studio/assignment/{assignment_id}")
    assert res.status_code == 200, "delete assignment"
