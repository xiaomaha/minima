import json

import pytest
from django.test.client import Client

from apps.survey.models import Submission
from apps.survey.tests.factories import SurveyFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_survey_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    survey = SurveyFactory(owner=admin_user.get_user())
    survey_id = survey.id

    # get content suggestions for survey
    res = client.get("/api/v1/studio/suggestion/content?kind=survey")
    assert res.status_code == 200, "get content suggestions for survey"

    # get survey
    res = client.get(f"/api/v1/studio/survey/{survey_id}")
    assert res.status_code == 200, "get survey"

    data = res.json()
    questions = data["questions"]
    del data["questions"]

    # save survey
    res = client.post("/api/v1/studio/survey", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save survey"

    data["id"] = ""
    data["title"] += "unique"

    # create new survey
    res = client.post("/api/v1/studio/survey", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new survey"

    # get survey questions
    res = client.get(f"/api/v1/studio/survey/{survey_id}/question")
    assert res.status_code == 200, "get survey questions"

    for question in questions:
        del question["id"]

    # save survey questions
    res = client.post(
        f"/api/v1/studio/survey/{survey_id}/question",
        data={"data": json.dumps({"data": questions})},
        format="multipart",
    )
    assert res.status_code == 200, "save survey questions"

    # delete survey question
    res = client.delete(f"/api/v1/studio/survey/{survey_id}/question/{res.json()[0]}")
    assert res.status_code == 200, "delete survey question"

    # delete survey
    Submission.objects.filter(survey_id=survey_id).delete()
    res = client.delete(f"/api/v1/studio/survey/{survey_id}")
    assert res.status_code == 200, "delete survey"
