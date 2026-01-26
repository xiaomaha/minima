import pytest
from django.test.client import Client

from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_partner_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    # get member infos
    res = client.get("/api/v1/partner/member/information")
    assert res.status_code == 200, "get member infos"
