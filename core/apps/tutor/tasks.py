from asgiref.sync import async_to_sync
from celery import shared_task
from django.db import InterfaceError, OperationalError

from apps.exam.models import Exam


@shared_task(bind=True, max_retries=3)
def regrade_exam_question_task(self, exam_id: str, question_id: int, to_answers: list[str]):
    try:
        async_to_sync(Exam.regrade_question)(exam_id=exam_id, question_id=question_id, to_answers=to_answers)
    except (OperationalError, InterfaceError) as exc:
        raise self.retry(exc=exc, countdown=2**self.request.retries * 5)
