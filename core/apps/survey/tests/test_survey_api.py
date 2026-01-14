import json
from typing import cast

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis import Generic

from apps.learning.tests.factories import EnrollmentFactory
from apps.survey.models import Survey
from apps.survey.tests.factories import SurveyFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_survey_flow(client: Client, mimesis: Generic, admin_user: AdminUser):

    survey = cast(Survey, SurveyFactory(anonymous=True))

    # get survey
    res = client.get(f"/api/v1/survey/{survey.id}")
    assert res.status_code == 401, "get survey 401 unauthorized"

    # submit survey
    data = {"fake_question_id": "fake_answer"}
    res = client.post(f"/api/v1/survey/{survey.id}/submit", data=data)
    assert res.status_code == 401, "submit survey 401 unauthorized"

    # get anonymous survey
    res = client.get(f"/api/v1/survey/{survey.id}/anonymous")
    assert res.status_code == 200, "get survey anonymous"

    # submit anonymous survey
    data = {question["id"]: mimesis.text.word() for question in res.json()["questions"]}
    res = client.post(
        f"/api/v1/survey/{survey.id}/anonymous/submit", data=json.dumps(data), content_type="application/json"
    )
    assert res.status_code == 200, "submit survey anonymous"

    survey = cast(Survey, SurveyFactory(anonymous=False, show_results=False))

    # get anonymous survey
    res = client.get(f"/api/v1/survey/{survey.id}/anonymous")
    assert res.status_code == 404, "get anonymous survey 404"

    # submit anonymous survey
    data = {"fake_question_id": "fake_answer"}
    res = client.post(
        f"/api/v1/survey/{survey.id}/anonymous/submit", data=json.dumps(data), content_type="application/json"
    )
    assert res.status_code == 400, "submit survey anonymous 400, access denied"

    admin_user.login()

    # get survey before enrollment
    res = client.get(f"/api/v1/survey/{survey.id}")
    assert res.status_code == 400, "get survey 400, access denied"

    # submit survey before enrollment
    data = {"fake_question_id": "fake_answer"}
    res = client.post(f"/api/v1/survey/{survey.id}/submit", data=data)
    assert res.status_code == 400, "submit survey 400, access denied"

    EnrollmentFactory(
        content_type=ContentType.objects.get_for_model(survey), content_id=survey.id, active=True, user_id=admin_user.id
    )

    # get survey after enrollment
    res = client.get(f"/api/v1/survey/{survey.id}")
    assert res.status_code == 200, "get survey"

    # submit survey after enrollment
    data = {question["id"]: mimesis.text.word() for question in res.json()["questions"]}
    res = client.post(f"/api/v1/survey/{survey.id}/submit", data=json.dumps(data), content_type="application/json")
    assert res.status_code == 200, "submit survey"

    # get results
    res = client.get(f"/api/v1/survey/{survey.id}/results")
    assert res.status_code == 400, "get results 400 access denied"
