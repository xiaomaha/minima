import mimesis
from django.conf import settings
from factory.declarations import Iterator, LazyFunction, SubFactory
from factory.django import DjangoModelFactory
from factory.helpers import post_generation
from mimesis.plugins.factory import FactoryField

from apps.account.tests.factories import UserFactory
from apps.assignment.tests.factories import AssignmentFactory
from apps.common.tests.factories import GradeWorkflowFactory, LearningObjectFactory
from apps.competency.tests.factories import CertificateFactory
from apps.content.tests.factories import MediaFactory
from apps.course.models import (
    TEMPLATE_SCHEDULES,
    Assessment,
    Course,
    CourseCategory,
    CourseCertificate,
    CourseInstructor,
    CourseRelation,
    CourseSurvey,
    Lesson,
    LessonMedia,
    MessagePreset,
)
from apps.discussion.tests.factories import DiscussionFactory
from apps.exam.tests.factories import ExamFactory
from apps.operation.models import Category
from apps.operation.tests.factories import FAQFactory, HonorCodeFactory, InstructorFactory
from apps.survey.tests.factories import SurveyFactory
from conftest import test_user_email

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class MessagePresetFactory(DjangoModelFactory[MessagePreset]):
    title = FactoryField("text.title")
    description = FactoryField("text")
    templates = LazyFunction(lambda: list(TEMPLATE_SCHEDULES.keys()))

    class Meta:
        model = MessagePreset
        django_get_or_create = ("title",)
        skip_postgeneration_save = True


class CourseFactory(LearningObjectFactory[Course], GradeWorkflowFactory[Course]):
    passing_point = FactoryField("choice", items=[60, 80])
    max_attempts = FactoryField("choice", items=[1, 2])
    verification_required = False

    owner = LazyFunction(lambda: UserFactory(email=test_user_email))
    objective = FactoryField("text")
    preview_url = "http://example.com"
    effort_hours = FactoryField("choice", items=[8, 16, 32])
    level = Iterator(Course.LevelChoices)
    honor_code = SubFactory(HonorCodeFactory)
    faq = SubFactory(FAQFactory)
    message_preset = SubFactory(MessagePresetFactory)

    class Meta:
        model = Course
        django_get_or_create = ("title", "owner")
        skip_postgeneration_save = True

    @post_generation
    def post_generation(self: Course, create, extracted, **kwargs):
        if not create:
            return

        course_categories = [
            CourseCategory(
                course=self, category=category, label=" / ".join([*category.ancestors, category.name]), ordering=i
            )
            for i, category in enumerate(Category.objects.filter(depth=3).order_by("?")[: generic.random.randint(2, 3)])
        ]
        CourseCategory.objects.bulk_create(course_categories, ignore_conflicts=True)

        course_relations = [
            CourseRelation(course=self, related_course=related, label=related.title, ordering=i)
            for i, related in enumerate(
                Course.objects.exclude(id=self.pk).order_by("?")[: generic.random.randint(2, 3)]
            )
        ]
        CourseRelation.objects.bulk_create(course_relations, ignore_conflicts=True)

        course_certificates = [
            CourseCertificate(course=self, certificate=certificate, label=certificate.name, ordering=i)
            for i, certificate in enumerate(CertificateFactory.create_batch(generic.random.randint(2, 3), active=True))
        ]
        CourseCertificate.objects.bulk_create(course_certificates, ignore_conflicts=True)

        instructors = InstructorFactory.create_batch(generic.random.randint(1, 3))
        if instructors:
            CourseInstructor.objects.bulk_create(
                [
                    CourseInstructor(
                        course=self, instructor=instructor, label=instructor.name, lead=True if i == 0 else False
                    )
                    for i, instructor in enumerate(instructors)
                ],
                ignore_conflicts=True,
            )

        count = generic.random.choice([8, 16, 32])
        last_lesson_start_offset = 0

        for i in range(count):
            media = MediaFactory.create(owner=self.owner)
            lesson, created = Lesson.objects.get_or_create(
                course=self, label=media.title, defaults={"start_offset": i * 7, "end_offset": 7}
            )
            last_lesson_start_offset = i * 7
            if created:
                LessonMedia(lesson=lesson, media=media, ordering=0).save()

                if i in [2, 4]:
                    extra_media = MediaFactory.create(owner=self.owner)
                    LessonMedia(lesson=lesson, media=extra_media, ordering=1).save()

        surveys = SurveyFactory.create_batch(2)
        if surveys:
            CourseSurvey.objects.bulk_create(
                [
                    CourseSurvey(
                        course=self, label=surveys[0].title, survey=surveys[0], start_offset=0, end_offset=None
                    ),
                    CourseSurvey(
                        course=self,
                        label=surveys[1].title,
                        survey=surveys[1],
                        start_offset=last_lesson_start_offset,
                        end_offset=None,
                    ),
                ],
                ignore_conflicts=True,
            )

        discussions = DiscussionFactory.create_batch(2)
        exams = ExamFactory.create_batch(2)
        assignments = AssignmentFactory.create_batch(2)

        last_lesson = self.lessons.last()
        course_days = last_lesson.start_offset + 7 if last_lesson else 30

        weeks = course_days // 7
        assessments_to_create = []

        discussion_weeks = [1, 5][: len(discussions)] if weeks >= 5 else [1, 3][: len(discussions)]
        assignment_weeks = [2, 6][: len(assignments)] if weeks >= 6 else [2, 4][: len(assignments)]

        if weeks >= 8:
            exam_weeks = [weeks // 2, weeks][: len(exams)]
        elif weeks >= 4:
            exam_weeks = [weeks][: len(exams)]
        else:
            exam_weeks = []

        for i, discussion in enumerate(discussions):
            if i < len(discussion_weeks):
                week = discussion_weeks[i]
                if week <= weeks:
                    start_offset = (week - 1) * 7
                    assessments_to_create.append(
                        Assessment(
                            course=self,
                            label=discussion.title,
                            weight=20,
                            start_offset=start_offset,
                            end_offset=7,
                            item=discussion,
                        )
                    )

        for i, assignment in enumerate(assignments):
            if i < len(assignment_weeks):
                week = assignment_weeks[i]
                if week <= weeks:
                    start_offset = (week - 1) * 7
                    assessments_to_create.append(
                        Assessment(
                            course=self,
                            label=assignment.title,
                            weight=30,
                            start_offset=start_offset,
                            end_offset=7,
                            item=assignment,
                        )
                    )

        for i, exam in enumerate(exams):
            if i < len(exam_weeks):
                week = exam_weeks[i]
                start_day = (week - 1) * 7
                assessments_to_create.append(
                    Assessment(
                        course=self, label=exam.title, weight=50, start_offset=start_day, end_offset=7, item=exam
                    )
                )

        Assessment.objects.bulk_create(assessments_to_create, ignore_conflicts=True)
