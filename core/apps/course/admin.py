from asgiref.sync import async_to_sync
from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from django_jsonform.forms.fields import JSONFormField
from unfold.decorators import action

from apps.common.admin import BooleanDatetimeFormMixin, HiddenModelAdmin, ModelAdmin, TabularInline
from apps.course.models import (
    TEMPLATE_SCHEDULES,
    Assessment,
    Course,
    CourseCategory,
    CourseCertificate,
    CourseInstructor,
    CourseRelation,
    CourseSurvey,
    Engagement,
    Gradebook,
    GradingPolicy,
    Lesson,
    LessonMedia,
    MessagePreset,
)


@admin.register(Course)
class CourseAdmin(ModelAdmin[Course]):
    class CategoryInline(TabularInline[CourseCategory]):
        model = CourseCategory
        verbose_name = _("Category")
        verbose_name_plural = _("Categories")
        ordering_field = "ordering"
        ordering = ("ordering",)

    class CertificateInline(TabularInline[CourseCertificate]):
        model = CourseCertificate
        verbose_name = _("Certificate")
        verbose_name_plural = _("Certificates")
        ordering_field = "ordering"
        ordering = ("ordering",)

    class CourseInstructorInline(TabularInline[CourseInstructor]):
        model = CourseInstructor
        ordering_field = "ordering"
        ordering = ("ordering",)

    class CourseSurveyInline(TabularInline[CourseSurvey]):
        model = CourseSurvey
        ordering_field = "ordering"
        ordering = ("start_offset", "ordering")

    class AssessmentInline(TabularInline[Assessment]):
        model = Assessment
        ordering_field = "ordering"
        ordering = ("start_offset", "ordering")

    class LessonInline(TabularInline[Lesson]):
        model = Lesson
        ordering_field = "ordering"
        ordering = ("start_offset", "ordering")

    class GradingPolicyInline(TabularInline[GradingPolicy]):
        model = GradingPolicy

    class CourseRelationInline(TabularInline[CourseRelation]):
        model = CourseRelation
        fk_name = "course"
        verbose_name = _("Related Course")
        verbose_name_plural = _("Related Courses")

    inlines = (
        CategoryInline,
        CertificateInline,
        CourseInstructorInline,
        CourseSurveyInline,
        LessonInline,
        AssessmentInline,
        GradingPolicyInline,
        CourseRelationInline,
    )


@admin.register(Lesson)
class LessonAdmin(HiddenModelAdmin[Lesson]):
    class LessonMediaInline(TabularInline[LessonMedia]):
        model = LessonMedia
        # orderable
        ordering = ("ordering", "id")
        ordering_field = "ordering"

    inlines = (LessonMediaInline,)


@admin.register(GradingPolicy)
class GradingPolicyAdmin(HiddenModelAdmin[GradingPolicy]):
    pass


@admin.register(CourseInstructor)
class CourseInstructorAdmin(HiddenModelAdmin[CourseInstructor]):
    pass


@admin.register(CourseSurvey)
class CourseSurveyAdmin(HiddenModelAdmin[CourseSurvey]):
    pass


@admin.register(Assessment)
class AssessmentAdmin(HiddenModelAdmin[Assessment]):
    pass


@admin.register(LessonMedia)
class LessonMediaAdmin(HiddenModelAdmin[LessonMedia]):
    pass


@admin.register(Engagement)
class EngagementAdmin(ModelAdmin[Engagement]):
    class GradebookInline(TabularInline[Gradebook]):
        class GradebookForm(BooleanDatetimeFormMixin):
            boolean_datetime_fields = ["confirmed"]

        form = GradebookForm
        model = Gradebook

    inlines = (GradebookInline,)

    actions_submit_line = ["grade"]

    @action(description=_("Grade"), permissions=["grade"])  # type: ignore
    def grade(self, request, obj: Engagement):
        async_to_sync(Engagement.grade)(course_id=obj.course.pk, learner_id=obj.learner.pk, grader=request.user)

    def has_grade_permission(self, request, object_id: str | int):
        return request.user.is_superuser


@admin.register(Gradebook)
class GradebookAdmin(ModelAdmin[Gradebook]):
    class GradebookForm(BooleanDatetimeFormMixin):
        boolean_datetime_fields = ["confirmed"]

    form = GradebookForm

    actions_submit_line = ["grade"]

    @action(description=_("Grade"), permissions=["grade"])  # type: ignore
    def grade(self, request, obj: Gradebook):
        async_to_sync(Engagement.grade)(
            course_id=obj.engagement.course.pk, learner_id=obj.engagement.learner.pk, grader=request.user
        )

    def has_grade_permission(self, request, object_id: str | int):
        return request.user.is_superuser


@admin.register(MessagePreset)
class MessagePresetAdmin(HiddenModelAdmin[MessagePreset]):
    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "templates":
            return JSONFormField(
                schema={"type": "array", "items": {"type": "string", "choices": list(TEMPLATE_SCHEDULES.keys())}}
            )
        return super().formfield_for_dbfield(db_field, request, **kwargs)


@admin.register(CourseCategory)
class CourseCategoryAdmin(HiddenModelAdmin[CourseCategory]):
    pass


@admin.register(CourseRelation)
class CourseRelationAdmin(HiddenModelAdmin[CourseRelation]):
    pass


@admin.register(CourseCertificate)
class CourseCertificateAdmin(HiddenModelAdmin[CourseCertificate]):
    pass
