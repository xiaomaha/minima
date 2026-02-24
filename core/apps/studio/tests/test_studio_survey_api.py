import json

import pytest
from django.test.client import Client

from apps.survey.tests.factories import SurveyFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_survey_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    SurveyFactory(owner=admin_user.get_user())

    # get content suggestions for survey
    res = client.get("/api/v1/studio/suggestion/content?kind=survey")
    assert res.status_code == 200, "get content suggestions for survey"

    survey_id = res.json()[0]["id"]

    # get survey
    res = client.get(f"/api/v1/studio/survey/{survey_id}")
    assert res.status_code == 200, "get survey"

    data = res.json()
    question_set = data["questionSet"]
    del data["questionSet"]

    # save survey
    res = client.post("/api/v1/studio/survey", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save survey"

    data["id"] = ""
    data["title"] += "unique"

    # create new survey
    res = client.post("/api/v1/studio/survey", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new survey"

    question = question_set[0]
    question["id"] = 0

    # save survey question
    res = client.post(
        f"/api/v1/studio/survey/{survey_id}/question", data={"data": json.dumps(question)}, format="multipart"
    )
    assert res.status_code == 200, "save survey question"

    # delete survey question
    res = client.delete(f"/api/v1/studio/survey/{survey_id}/question/{res.json()}")
    assert res.status_code == 200, "delete survey question"

    for question in question_set:
        question["question"] += "1"

    # save survey questions
    res = client.post(
        f"/api/v1/studio/survey/{survey_id}/questionset",
        data={"data": json.dumps({"data": question_set})},
        format="multipart",
    )
    assert res.status_code == 200, "save survey questions"
