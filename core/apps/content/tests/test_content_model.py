import pytest

from apps.content.tests.factories import MediaFactory


@pytest.mark.django_db
def test_media():
    MediaFactory.create()
