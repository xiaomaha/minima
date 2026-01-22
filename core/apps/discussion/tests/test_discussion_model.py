import pytest

from apps.discussion.tests.factories import DiscussionFactory


@pytest.mark.django_db
def test_discussion():
    DiscussionFactory.create()
