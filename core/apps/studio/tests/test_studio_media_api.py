import json

import pytest
from django.test.client import Client

from apps.content.tests.factories import MediaFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_media_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    MediaFactory(owner=admin_user.get_user())

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=media")
    assert res.status_code == 200, "get content suggestions"

    media_id = res.json()[0]["id"]

    # get media
    res = client.get(f"/api/v1/studio/media/{media_id}")
    assert res.status_code == 200, "get media"

    data = res.json()

    # save media
    res = client.post("/api/v1/studio/media", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save media"

    data["id"] = ""
    data["url"] += "?unique"

    # create new media
    res = client.post("/api/v1/studio/media", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new media"
