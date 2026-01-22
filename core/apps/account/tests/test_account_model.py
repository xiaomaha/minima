import pytest

from apps.account.tests.factories import UserFactory


@pytest.mark.django_db
def test_user():
    UserFactory.create()
