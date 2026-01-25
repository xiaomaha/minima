import pytest

from apps.survey.tests.factories import SurveyFactory


@pytest.mark.django_db
def test_survey():
    SurveyFactory.create()
