import pytest
from django.test.client import Client

from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_enrollment_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    # get enrollments
    res = client.get("/api/v1/learning/enrollment")
    assert res.status_code == 200, "get enrollments"

    # get records
    res = client.get("/api/v1/learning/record")
    assert res.status_code == 200, "get records"

    # get catalogs
    res = client.get("/api/v1/learning/catalog")
    assert res.status_code == 200, "get catalogs"

    # get report
    start = "2026-01-01"
    end = "2026-12-31"
    res = client.get("/api/v1/learning/report", query_params={"start": start, "end": end})
    assert res.status_code == 200, "get report"
