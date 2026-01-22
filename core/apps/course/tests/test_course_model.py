import pytest

from apps.course.tests.factories import CourseFactory


@pytest.mark.order(-2)
@pytest.mark.django_db
def test_course():
    CourseFactory.create()
