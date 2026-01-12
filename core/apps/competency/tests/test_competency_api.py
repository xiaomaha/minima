import json

import pytest
from django.test.client import Client
from mimesis.providers.generic import Generic

from apps.competency.models import Classification, Factor
from apps.competency.tests.factories import CompetencyGoalFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_competency_flow(client: Client, mimesis: Generic, admin_user: AdminUser):
    admin_user.login()

    # skip: certificate api will be tested in course api test

    CompetencyGoalFactory(user=admin_user.get_user())

    # get competency goals
    res = client.get("/api/v1/competency/goal")
    assert res.status_code == 200, "get competency goals"

    # create competency goal
    classification = Classification.objects.filter(depth=4).first()
    assert classification, "get classification"

    # update competency goal
    data = {
        "name": " ".join(mimesis.text.words(mimesis.random.randint(3, 5))),
        "description": mimesis.text.text(),
        "classification_id": classification.pk,
        "factor_ids": list(Factor.objects.filter(skill__classification=classification).values_list("id", flat=True)),
    }
    res = client.post("/api/v1/competency/goal", data=json.dumps(data), content_type="application/json")
    assert res.status_code == 200, "update competency goal"

    # create competency goal
    data["name"] += " 2"
    res = client.post("/api/v1/competency/goal", data=json.dumps(data), content_type="application/json")
    assert res.status_code == 200, "create competency goal"

    # delete competency goal
    goal_id = res.json()["id"]
    res = client.delete(f"/api/v1/competency/goal/{goal_id}")
    assert res.status_code == 200, "delete competency goal"

    # get classification tree
    res = client.get("/api/v1/competency/classification/tree")
    assert res.status_code == 200, "get classification tree"

    # get skill data
    res = client.get(f"/api/v1/competency/classification/{classification.pk}/skill/data")
    assert res.status_code == 200, "get skill data"
