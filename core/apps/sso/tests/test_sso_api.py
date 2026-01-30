import json
from unittest.mock import AsyncMock, patch

import pytest
from django.test.client import Client
from django.test.utils import override_settings

from apps.account.models import User
from apps.common.models import tuid
from apps.sso.models import SSOAccount


@pytest.mark.e2e
@pytest.mark.django_db
@override_settings(ALLOWED_REDIRECT_ORIGINS=["http://localhost:3000", "http://testserver"])
def test_sso_flow(client: Client, mimesis):
    redirect_to = "http://localhost:3000/auth/callback"

    res = client.post(
        "/api/v1/sso/google/authorize", data=json.dumps({"redirectTo": redirect_to}), content_type="application/json"
    )
    assert res.status_code == 200
    auth_url = res.json()["authorizationUrl"]
    assert "accounts.google.com" in auth_url

    state = auth_url.split("state=")[1].split("&")[0]

    mock_user_info = {
        "provider_user_id": f"google-{tuid(12)}",
        "email": f"{tuid(12)}.{mimesis.person.email()}",
        "name": mimesis.person.name(),
    }

    mock_tokens = {"access_token": "mock_access_token", "id_token": "mock_id_token", "token_type": "Bearer"}

    with (
        patch("apps.sso.providers.google.GoogleProvider.exchange_code", new_callable=AsyncMock) as mock_exchange,
        patch("apps.sso.providers.google.GoogleProvider.get_user_info", new_callable=AsyncMock) as mock_user,
    ):
        mock_exchange.return_value = mock_tokens
        mock_user.return_value = mock_user_info

        res = client.get(f"/api/v1/sso/google/callback?code=mock_code&state={state}")
        assert res.status_code in [200, 302]

    user = User.objects.get(email=mock_user_info["email"])
    assert user.is_active

    sso_account = SSOAccount.objects.get(user=user, provider="google")
    assert sso_account.provider_user_id == mock_user_info["provider_user_id"]

    res = client.get("/api/v1/account/me")
    assert res.status_code == 200
    assert res.json()["email"] == mock_user_info["email"]

    res = client.get("/api/v1/sso/account")
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) == 1
    assert accounts[0]["provider"] == "google"

    account_id = accounts[0]["id"]
    res = client.delete(f"/api/v1/sso/account/{account_id}")
    assert res.status_code == 200

    res = client.get("/api/v1/sso/account")
    assert len(res.json()) == 0

    client.post("/api/v1/account/logout")
