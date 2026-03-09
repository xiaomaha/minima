import json

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis.providers.generic import Generic
from pytest_mock import MockerFixture

from apps.exam.tests.factories import ExamFactory
from apps.tutor.models import Allocation
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_tutor_exam_flow(client: Client, mimesis: Generic, admin_user: AdminUser, mocker: MockerFixture):
    admin_user.login()

    exam = ExamFactory()
    content_type = ContentType.objects.get_for_model(exam)

    tutor = admin_user.get_user()
    Allocation.objects.create(tutor=tutor, content_type=content_type, content_id=exam.id)

    res = client.get("/api/v1/tutor/allocation")
    assert res.status_code == 200, "get allocation"

    # get exam grades list
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/grade")
    assert res.status_code == 200, "get exam grades"

    grades = res.json()["items"]
    assert len(grades) > 0, "exam has grades from factory"
    grade_id = grades[0]["id"]

    # get grade paper
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/grade/{grade_id}")
    assert res.status_code == 200, "get grade paper"

    paper = res.json()
    assert "earnedDetails" in paper
    assert "questions" in paper

    questions = paper["questions"]
    assert len(questions) > 0, "grade paper has manual grading questions"

    # complete grade
    earned_details = {str(q["id"]): q["point"] for q in questions}
    feedback = {str(q["id"]): mimesis.text.sentence() for q in questions}
    res = client.post(
        f"/api/v1/tutor/exam/{exam.id}/grade/{grade_id}",
        data=json.dumps({"earnedDetails": earned_details, "feedback": feedback}),
        content_type="application/json",
    )
    assert res.status_code == 200, "complete grade"
    assert res.json()["completed"] is not None, "grade completed after grading"
