import json

import pytest
from django.contrib.contenttypes.models import ContentType
from django.test.client import Client
from mimesis.providers.generic import Generic
from pytest_mock import MockerFixture

from apps.exam.models import Question
from apps.exam.tests.factories import ExamFactory
from apps.operation.models import Appeal
from apps.tutor.api.v1.exam import regrade_question
from apps.tutor.models import Allocation
from conftest import AdminUser


@pytest.mark.e2e
@pytest.mark.django_db
def test_tutor_exam_flow(client: Client, mimesis: Generic, admin_user: AdminUser, mocker: MockerFixture):
    admin_user.login()

    exam = ExamFactory()
    exam_ct = ContentType.objects.get_for_model(exam)

    tutor = admin_user.get_user()
    Allocation.objects.create(tutor=tutor, content_type=exam_ct, content_id=exam.id)

    res = client.get("/api/v1/tutor/allocation")
    assert res.status_code == 200, "get allocation"

    # get exam grades list
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/grade")
    assert res.status_code == 200, "get exam grades"

    grades = res.json()["items"]
    assert len(grades) > 0, "exam has grades from factory"
    grade_id = grades[0]["id"]

    # get grade paper
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/grade/{grade_id}")
    assert res.status_code == 200, "get grade paper"

    paper = res.json()
    assert "earnedDetails" in paper
    assert "questions" in paper

    questions = paper["questions"]
    assert len(questions) > 0, "grade paper has manual grading questions"

    # complete grade
    earned_details = {str(q["id"]): q["point"] for q in questions}
    feedback = {str(q["id"]): mimesis.text.sentence() for q in questions}
    res = client.post(
        f"/api/v1/tutor/exam/{exam.id}/grade/{grade_id}",
        data=json.dumps({"earnedDetails": earned_details, "feedback": feedback}),
        content_type="application/json",
    )
    assert res.status_code == 200, "complete grade"
    assert res.json()["completed"] is not None, "grade completed after grading"

    # get exam appeals
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/appeal")
    assert res.status_code == 200, "get exam appeals"
    assert res.json()["count"] == 0, "no appeals yet"

    # create an appeal for a question
    question = Question.objects.filter(pool__exam=exam).first()
    assert question is not None
    question_ct = ContentType.objects.get_for_model(question)
    appeal = Appeal.objects.create(
        learner=tutor, explanation=mimesis.text.text(), question_type=question_ct, question_id=question.id
    )

    # get appeals again
    res = client.get(f"/api/v1/tutor/exam/{exam.id}/appeal")
    assert res.status_code == 200, "get exam appeals with appeal"
    assert res.json()["count"] == 1, "one appeal"

    # review appeal
    res = client.post(
        f"/api/v1/tutor/exam/{exam.id}/appeal",
        data=json.dumps({"review": mimesis.text.sentence(), "appealIds": [appeal.id]}),
        content_type="application/json",
    )
    assert res.status_code == 200, "review appeal"
    appeal.refresh_from_db()
    assert appeal.review != "", "appeal review saved"

    # update question solution
    mocker.patch("apps.tutor.api.v1.exam.regrade_question.delay")
    single_choice_q = Question.objects.filter(
        pool__exam=exam, format=Question.ExamQuestionFormatChoices.SINGLE_CHOICE
    ).first()
    new_answer = "99"
    assert single_choice_q is not None
    original_correct_answers = list(single_choice_q.solution.correct_answers)

    res = client.post(
        f"/api/v1/tutor/exam/{exam.id}/question/{single_choice_q.id}/solution",
        data=json.dumps({
            "correctAnswers": [new_answer],
            "correct_criteria": "update criteria",
            "explanation": "update explanation",
        }),
        content_type="application/json",
    )
    assert res.status_code == 200, "update question solution"
    assert single_choice_q is not None

    regrade_question.delay.assert_called_once_with(  # type: ignore
        exam_id=exam.id, question_id=single_choice_q.id, from_answers=original_correct_answers, to_answers=[new_answer]
    )

    res = client.post(
        f"/api/v1/tutor/exam/{exam.id}/question/{single_choice_q.id}/solution",
        data=json.dumps({
            "correctAnswers": [new_answer],
            "correct_criteria": "update criteria",
            "explanation": "update explanation",
        }),
        content_type="application/json",
    )
    assert res.status_code == 200, "update solution no-op"
    assert regrade_question.delay.call_count == 1, "regrade not called again for same answers"  # type: ignore
