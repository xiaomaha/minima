import pytest

from apps.exam.tests.factories import ExamFactory


@pytest.mark.django_db
def test_exam():
    ExamFactory.create()
