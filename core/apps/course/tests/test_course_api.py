import json

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from django.utils import timezone
from mimesis.providers.generic import Generic

from apps.course.models import Course, Gradebook
from apps.course.tests.factories import CourseFactory
from apps.learning.tests.factories import EnrollmentFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_course_flow(client: Client, mimesis: Generic, admin_user: AdminUser):
    admin_user.login()

    course: Course = CourseFactory(verification_required=True)
    EnrollmentFactory(
        content_type=ContentType.objects.get_for_model(course), content_id=course.id, active=True, user_id=admin_user.id
    )

    # get course session
    res = client.get(f"/api/v1/course/{course.id}/session")
    assert res.status_code == 200, "get course session"

    # otp
    admin_user.setup_otp()
    res = admin_user.verify_otp(token=res.json()["otpToken"])

    # start new course engagement
    res = client.post(f"/api/v1/course/{course.id}/engage")
    assert res.status_code == 200, "start new course attempt"
    engagement_id = res.json()["id"]

    # get course detail
    res = client.get(f"/api/v1/course/{course.id}/detail")
    assert res.status_code == 200, "get course detail"

    certificate_id = res.json()["courseCertificates"][0]["certificate"]["id"]

    Gradebook.objects.create(
        engagement_id=engagement_id, details={}, score=0.0, completion_rate=0.0, passed=True, confirmed=timezone.now()
    )

    # request certificate
    res = client.post(
        f"/api/v1/course/{course.id}/certificate/request",
        data=json.dumps({"certificateId": certificate_id}),
        content_type="application/json",
    )
    assert res.status_code == 200, "request certificate"
