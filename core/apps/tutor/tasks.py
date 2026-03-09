from asgiref.sync import async_to_sync
from celery import shared_task

from apps.exam.models import Exam


@shared_task
def regrade_question(exam_id: str, question_id: int, from_answers: list[str], to_answers: list[str]):
    async_to_sync(Exam.regrade_question)(
        exam_id=exam_id, question_id=question_id, from_answers=from_answers, to_answers=to_answers
    )
