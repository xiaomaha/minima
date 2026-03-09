from datetime import datetime

from apps.common.schema import Schema
from apps.common.util import GradingDate


class TutorGradeSchema(Schema):
    id: int
    created: datetime
    score: float
    passed: bool
    completed: datetime | None
    confirmed: datetime | None
    attempt_retry: int
    grading_date: GradingDate


class TutorGradeSaveSchema(Schema):
    earned_details: dict[str, int | None]
    feedback: dict[str, str]


class TutorGraeCompleteSchema(Schema):
    score: float
    passed: bool
    completed: datetime | None
