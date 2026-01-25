import pytest

from apps.partner.tests.factories import CohortFactory, PartnerFactory


@pytest.mark.django_db
def test_partner():
    PartnerFactory.create()
    CohortFactory.create()
