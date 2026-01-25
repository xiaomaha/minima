import mimesis
import pytest
from django.conf import settings

from apps.learning.tests.factories import CatalogFactory, EnrollmentFactory

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


@pytest.mark.order(-1)
@pytest.mark.django_db
def test_enrollment():
    EnrollmentFactory.create_batch(7)
    CatalogFactory.create_batch(2)
