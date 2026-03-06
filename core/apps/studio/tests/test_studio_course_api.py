import json

import pytest
from django.test.client import Client

from apps.course.models import CourseRelation
from apps.course.tests.factories import CourseFactory
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_studio_course_flow(client: Client, admin_user: AdminUser):
    admin_user.login()

    c1, c2 = CourseFactory.create_batch(2, owner=admin_user.get_user())
    CourseRelation.objects.get_or_create(course=c1, related_course=c2, defaults={"label": c2.title, "ordering": 0})
    CourseRelation.objects.get_or_create(course=c2, related_course=c1, defaults={"label": c1.title, "ordering": 0})

    # get content suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=course")
    assert res.status_code == 200, "get content suggestions"

    course_id = c2.id

    # get course
    res = client.get(f"/api/v1/studio/course/{course_id}")
    assert res.status_code == 200, "get course"

    data = res.json()
    assets = data["assets"]
    del data["assets"]

    # save course
    res = client.post("/api/v1/studio/course", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "save course"

    data["id"] = ""
    data["title"] += "unique"

    # create new course
    res = client.post("/api/v1/studio/course", data={"data": json.dumps(data)}, format="multipart")
    assert res.status_code == 200, "create new course"

    course_surveys = assets["courseSurveys"]

    # save course surveys
    res = client.post(
        f"/api/v1/studio/course/{course_id}/survey", data=json.dumps(course_surveys), content_type="application/json"
    )
    assert res.status_code == 200, "save course surveys"

    # delete course survey
    res = client.delete(f"/api/v1/studio/course/{course_id}/survey/{course_surveys[0]['id']}")
    assert res.status_code == 200, "delete course survey"

    assessments = assets["assessments"]

    # save course assessments
    res = client.post(
        f"/api/v1/studio/course/{course_id}/assessment", data=json.dumps(assessments), content_type="application/json"
    )
    assert res.status_code == 200, "save course assessments"

    # delete course assessment
    res = client.delete(f"/api/v1/studio/course/{course_id}/assessment/{assessments[0]['id']}")
    assert res.status_code == 200, "delete course assessment"

    lessons = assets["lessons"]

    # save course lessons
    res = client.post(
        f"/api/v1/studio/course/{course_id}/lesson", data=json.dumps(lessons), content_type="application/json"
    )
    assert res.status_code == 200, "save course lessons"

    # delete course lesson
    res = client.delete(f"/api/v1/studio/course/{course_id}/lesson/{lessons[0]['id']}")
    assert res.status_code == 200, "delete course lesson"

    # certificate suggestions
    res = client.get("/api/v1/studio/suggestion/inline?kind=certificate")
    assert res.status_code == 200, "get certificate suggestions"

    # save course certificates
    course_certificates = assets["courseCertificates"]
    res = client.post(
        f"/api/v1/studio/course/{course_id}/certificate",
        data=json.dumps(course_certificates),
        content_type="application/json",
    )
    assert res.status_code == 200, "save course certificates"

    course_certificate_id = course_certificates[0]["id"]
    certificate_id = course_certificates[0]["certificateId"]

    # delete certificate
    res = client.delete(f"/api/v1/studio/course/{course_id}/certificate/{course_certificate_id}")
    assert res.status_code == 200, "delete certificate"

    # add certificate
    res = client.post(
        f"/api/v1/studio/course/{course_id}/certificate",
        data=json.dumps([{"certificateId": certificate_id, "label": "new certificate"}]),
        content_type="application/json",
    )
    assert res.status_code == 200, "add certificate"

    # suggestions
    res = client.get("/api/v1/studio/suggestion/content?kind=course")
    assert res.status_code == 200, "get content suggestions"

    # save course relations
    course_relations = assets["courseRelations"]
    res = client.post(
        f"/api/v1/studio/course/{course_id}/relation",
        data=json.dumps(course_relations),
        content_type="application/json",
    )
    assert res.status_code == 200, "save course relation"

    course_relation_id = course_relations[0]["id"]
    related_course_id = course_relations[0]["relatedCourseId"]

    # delete related course
    res = client.delete(f"/api/v1/studio/course/{course_id}/relation/{course_relation_id}")
    assert res.status_code == 200, "delete related course"

    # add related course
    res = client.post(
        f"/api/v1/studio/course/{course_id}/relation",
        data=json.dumps([{"relatedCourseId": related_course_id, "label": "new related course"}]),
        content_type="application/json",
    )
    assert res.status_code == 200, "add related course"

    # category suggestions
    res = client.get("/api/v1/studio/suggestion/inline?kind=category")
    assert res.status_code == 200, "get category suggestions"

    # save category
    course_categories = assets["courseCategories"]
    res = client.post(
        f"/api/v1/studio/course/{course_id}/category",
        data=json.dumps(course_categories),
        content_type="application/json",
    )
    assert res.status_code == 200, "save category"

    course_category_id = course_categories[0]["id"]
    category_id = course_categories[0]["categoryId"]

    # delete category
    res = client.delete(f"/api/v1/studio/course/{course_id}/category/{course_category_id}")
    assert res.status_code == 200, "delete category"

    # add category
    res = client.post(
        f"/api/v1/studio/course/{course_id}/category",
        data=json.dumps([{"categoryId": category_id, "label": "new category"}]),
        content_type="application/json",
    )
    assert res.status_code == 200, "add category"

    # instructor suggestions
    res = client.get("/api/v1/studio/suggestion/inline?kind=instructor")
    assert res.status_code == 200, "get instructor suggestions"

    # save instructor
    course_instructors = assets["courseInstructors"]
    res = client.post(
        f"/api/v1/studio/course/{course_id}/instructor",
        data=json.dumps(course_instructors[:2]),
        content_type="application/json",
    )
    assert res.status_code == 200, "save instructor"

    course_instructor_id = course_instructors[0]["id"]
    instructor_id = course_instructors[0]["instructorId"]

    # delete instructor
    res = client.delete(f"/api/v1/studio/course/{course_id}/instructor/{course_instructor_id}")
    assert res.status_code == 200, "delete instructor"

    # add instructor
    res = client.post(
        f"/api/v1/studio/course/{course_id}/instructor",
        data=json.dumps([{"instructorId": instructor_id, "label": "new instructor", "lead": True}]),
        content_type="application/json",
    )
    assert res.status_code == 200, "add instructor"
