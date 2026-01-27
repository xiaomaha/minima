from typing import cast

from asgiref.sync import async_to_sync
from django.contrib import admin
from django.db.models import Prefetch
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _
from django_jsonform.forms.fields import JSONFormField
from unfold.contrib.forms.widgets import WysiwygWidget
from unfold.decorators import action

from apps.common.admin import (
    HiddenModelAdmin,
    ModelAdmin,
    ReadOnlyHiddenModelAdmin,
    ReadOnlyTabularInline,
    TabularInline,
)
from apps.exam.models import Attempt, Exam, Grade, Question, QuestionPool, Solution, Submission, TempAnswer


@admin.register(QuestionPool)
class QuestionPoolAdmin(ModelAdmin[QuestionPool]):
    class QuestionInline(TabularInline[Question]):
        model = Question

    inlines = (QuestionInline,)


@admin.register(Exam)
class ExamAdmin(ModelAdmin[Exam]):
    def get_list_display(self, request: HttpRequest):
        return tuple(
            str(field)
            for field in super().get_list_display(request)
            if field not in ("__str__", "grade_due_days", "approval_due_days", "confirm_due_days")
        )


@admin.register(Question)
class QuestionAdmin(HiddenModelAdmin[Question]):
    class SolutionInline(TabularInline[Solution]):
        model = Solution

    inlines = (SolutionInline,)

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name in "supplement":
            kwargs["widget"] = WysiwygWidget
        return super().formfield_for_dbfield(db_field, request, **kwargs)


@admin.register(Solution)
class SolutionAdmin(HiddenModelAdmin[Solution]):
    pass


@admin.register(Attempt)
class AttemptAdmin(ModelAdmin[Attempt]):
    class TempAnswerInline(TabularInline[TempAnswer]):
        model = TempAnswer

    class SubmissionInline(TabularInline[Submission]):
        model = Submission

    class GradeInline(TabularInline[Grade]):
        model = Grade

    class QuestionInline(TabularInline[Question]):
        model = Attempt.questions.through
        verbose_name = _("Question")
        verbose_name_plural = _("Questions")
        ordering = ("id",)

        def get_queryset(self, request):
            return super().get_queryset(request).order_by("question_id")  # not id but question_id

    inlines = (QuestionInline, TempAnswerInline, SubmissionInline, GradeInline)

    def get_fields(self, request, obj=None):
        return [f for f in super().get_fields(request, obj=obj) if f not in ("questions",)]


@admin.register(TempAnswer)
class TempAnswerAdmin(HiddenModelAdmin[TempAnswer]):
    pass


@admin.register(Submission.pgh_event_model)
class SubmissionEventAdmin(ReadOnlyHiddenModelAdmin[Submission.pgh_event_model]):
    pass


@admin.register(Submission)
class SubmissionAdmin(ModelAdmin[Submission]):
    class SubmissionEventInline(ReadOnlyTabularInline[Submission.pgh_event_model]):
        model = Submission.pgh_event_model
        verbose_name = _("Submission History")
        verbose_name_plural = _("Submission Histories")

    inlines = (SubmissionEventInline,)


@admin.register(Grade.pgh_event_model)
class GradeEventAdmin(ReadOnlyHiddenModelAdmin[Grade.pgh_event_model]):
    pass


@admin.register(Grade)
class GradeAdmin(ModelAdmin[Grade]):
    class GradeEventInline(ReadOnlyTabularInline[Grade.pgh_event_model]):
        model = Grade.pgh_event_model
        verbose_name = _("Grading History")
        verbose_name_plural = _("Grading Histories")

    inlines = (GradeEventInline,)

    actions_submit_line = ["grade"]

    @action(description=_("Grade"), permissions=["grade"])  # type: ignore
    def grade(self, request: HttpRequest, obj: Grade):
        grade = (
            Grade.objects
            .select_related("attempt__submission", "attempt__exam")
            .prefetch_related(
                Prefetch("attempt__questions", queryset=Question.objects.select_related("solution").order_by("id"))
            )
            .get(pk=obj.pk)
        )
        async_to_sync(grade.grade)(grader_id=cast(str, request.user.pk) if request.user else None)

    def has_grade_permission(self, request, object_id: str | int):
        return request.user.is_superuser

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "earned_details":
            return JSONFormField(
                schema={"type": "dict", "keys": {}, "additionalProperties": {"type": "integer"}},
                label=_("Earned Details"),
            )
        if db_field.name == "feedback":
            return JSONFormField(
                schema={"type": "dict", "keys": {}, "additionalProperties": {"type": "string", "widget": "textarea"}},
                label=_("Feedback"),
                required=False,
            )
        return super().formfield_for_dbfield(db_field, request, **kwargs)
