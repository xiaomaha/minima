import pytest

from apps.sso.tests.factories import SSOAccountFactory, SSOSessionFactory


@pytest.mark.django_db
def test_sso():
    SSOAccountFactory.create()
    SSOSessionFactory.create()
