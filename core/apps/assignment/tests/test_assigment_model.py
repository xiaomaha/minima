import pytest

from apps.assignment.tests.factories import AssignmentFactory, RubricFactory


@pytest.mark.django_db
def test_assignment():
    AssignmentFactory.create()
    RubricFactory.create()
