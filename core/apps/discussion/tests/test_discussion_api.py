import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis.providers.generic import Generic

from apps.discussion.tests.factories import DiscussionFactory
from apps.learning.tests.factories import EnrollmentFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_discussion_flow(client: Client, mimesis: Generic, admin_user: AdminUser):
    admin_user.login()

    discussion = DiscussionFactory.create(title=mimesis.text.title(), verification_required=True)
    EnrollmentFactory(
        content_type=ContentType.objects.get_for_model(discussion),
        content_id=discussion.id,
        active=True,
        user_id=admin_user.id,
    )

    # get discussion session
    res = client.get(f"/api/v1/discussion/{discussion.id}/session")
    assert res.status_code == 200, "get discussion session"

    # otp
    admin_user.setup_otp()
    res = admin_user.verify_otp(token=res.json()["otpToken"])

    # start new discussion attempt
    res = client.post(f"/api/v1/discussion/{discussion.id}/attempt")
    assert res.status_code == 200, "start new discussion attempt"

    # get posts
    res = client.get(f"/api/v1/discussion/{discussion.id}/post")
    assert res.status_code == 200, "get posts"

    # get own posts
    res = client.get(f"/api/v1/discussion/{discussion.id}/post/own")
    assert res.status_code == 200, "get own posts"

    # create post
    res = client.post(
        f"/api/v1/discussion/{discussion.id}/post", data={"title": "a" * 20, "body": "b" * 200}, format="multipart"
    )
    assert res.status_code == 200, "create post"
    post = res.json()

    # update post
    res = client.post(
        f"/api/v1/discussion/{discussion.id}/post/{post['id']}",
        data={"title": "a" * 20, "body": "b" * 200},
        format="multipart",
    )
    assert res.status_code == 200, "update post"
    post = res.json()

    # delete post
    res = client.delete(f"/api/v1/discussion/{discussion.id}/post/{post['id']}")
    assert res.status_code == 200, "delete post"

    discussion.max_attempts = 2
    discussion.save()

    # deactivate attempt
    res = client.delete(f"/api/v1/discussion/{discussion.id}/attempt/deactivate")
    assert res.status_code == 200, "deactivate attempt"
