import pytest

from apps.competency.tests.factories import BadgeFactory, CertificateFactory, CompetencyGoalFactory


@pytest.mark.django_db
def test_competency():
    BadgeFactory.create()
    CertificateFactory.create()
    CompetencyGoalFactory.create()
