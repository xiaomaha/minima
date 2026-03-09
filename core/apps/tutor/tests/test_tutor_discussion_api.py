import json

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis.providers.generic import Generic

from apps.discussion.tests.factories import DiscussionFactory
from apps.tutor.models import Allocation
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_tutor_discussion_flow(client: Client, mimesis: Generic, admin_user: AdminUser):
    admin_user.login()

    discussion = DiscussionFactory()
    content_type = ContentType.objects.get_for_model(discussion)

    tutor = admin_user.get_user()
    Allocation.objects.create(tutor=tutor, content_type=content_type, content_id=discussion.id)

    res = client.get("/api/v1/tutor/allocation")
    assert res.status_code == 200, "get allocation"

    # get discussion grades list
    res = client.get(f"/api/v1/tutor/discussion/{discussion.id}/grade")
    assert res.status_code == 200, "get discussion grades"

    grades = res.json()["items"]
    assert len(grades) > 0, "discussion has grades from factory"
    grade_id = grades[0]["id"]

    # get grade paper
    res = client.get(f"/api/v1/tutor/discussion/{discussion.id}/grade/{grade_id}")
    assert res.status_code == 200, "get grade paper"

    paper = res.json()
    assert "earnedDetails" in paper
    assert "question" in paper

    earned_details = {"tutor_assessment": 1}
    feedback = {name: mimesis.text.sentence() for name in earned_details.keys()}

    # complete grade
    res = client.post(
        f"/api/v1/tutor/discussion/{discussion.id}/grade/{grade_id}",
        data=json.dumps({"earnedDetails": earned_details, "feedback": feedback}),
        content_type="application/json",
    )
    assert res.status_code == 200, "complete grade"
    assert res.json()["completed"] is not None, "grade completed after grading"
