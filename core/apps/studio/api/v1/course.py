import asyncio
import logging
from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.aggregates import ArrayAgg
from django.db import DataError, IntegrityError, ProgrammingError, transaction
from django.db.models import Prefetch, Q
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import HttpUrl, RootModel

from apps.common.error import ErrorCode
from apps.common.schema import (
    ContentTypeSchema,
    FileSizeValidator,
    FileTypeValidator,
    LearningObjectMixinSchema,
    Schema,
)
from apps.common.util import HttpRequest
from apps.course.models import (
    ASSESSIBLE_MODELS,
    Assessment,
    Course,
    CourseCategory,
    CourseCertificate,
    CourseInstructor,
    CourseRelation,
    CourseSurvey,
    GradingPolicy,
    Lesson,
    LessonMedia,
)
from apps.studio.decorator import editor_required, track_draft

log = logging.getLogger(__name__)


class GradingPolicySpec(Schema):
    assessment_weight: int
    completion_weight: int
    completion_passing_point: int


class CourseSurveySpec(Schema):
    id: int
    label: str
    survey_id: str
    start_offset: int
    end_offset: int | None


class LessonSpec(Schema):
    id: int
    label: str
    media_ids: list[str]
    start_offset: int
    end_offset: int | None


class AssessmentSpec(Schema):
    id: int
    label: str
    item_id: str
    item_type: ContentTypeSchema
    weight: int
    start_offset: int
    end_offset: int | None


class CourseInstructorSpec(Schema):
    id: int
    label: str
    instructor_id: int
    lead: bool


class CourseCertificateSpec(Schema):
    id: int
    label: str
    certificate_id: int


class CourseRelationSpec(Schema):
    id: int
    label: str
    related_course_id: str


class CourseCategorySpec(Schema):
    id: int
    label: str
    category_id: int


class FAQItemSpec(Schema):
    id: int
    question: str
    answer: str
    active: bool


class CourseAssetsSpec(Schema):
    lessons: list[LessonSpec]
    assessments: list[AssessmentSpec]
    course_relations: list[CourseRelationSpec]
    course_surveys: list[CourseSurveySpec]
    course_certificates: list[CourseCertificateSpec]
    course_categories: list[CourseCategorySpec]
    course_instructors: list[CourseInstructorSpec]


class CourseSpec(LearningObjectMixinSchema):
    id: str
    objective: str
    preview_url: str | None
    effort_hours: int
    level: Course.LevelChoices
    honor_code_id: int
    faq_id: int
    grading_policy: GradingPolicySpec
    assets: CourseAssetsSpec

    @staticmethod
    def resolve_assets(obj: Course):
        return {
            "lessons": obj.lessons.all(),
            "assessments": obj.assessments.all(),
            "course_relations": obj.course_relations.all(),
            "course_surveys": obj.course_surveys.all(),
            "course_certificates": obj.course_certificates.all(),
            "course_categories": obj.course_categories.all(),
            "course_instructors": obj.course_instructors.all(),
        }


class CourseSaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    passing_point: int
    max_attempts: int
    verification_required: bool
    objective: str
    preview_url: HttpUrl
    effort_hours: int
    level: Course.LevelChoices
    honor_code_id: int
    faq_id: int
    grading_policy: GradingPolicySpec


router = Router(by_alias=True)


@router.get("/course/{id}", response=CourseSpec)
@editor_required()
async def get_course(request: HttpRequest, id: str):
    return (
        await Course.objects
        .prefetch_related(
            Prefetch(
                "lessons",
                queryset=Lesson.objects.annotate(
                    media_ids=ArrayAgg(
                        "lesson_medias__media_id",
                        filter=Q(lesson_medias__lesson_id__isnull=False),
                        order_by="lesson_medias__ordering",
                        default=[],
                    )
                ).order_by("start_offset", "ordering"),
            )
        )
        .prefetch_related(
            Prefetch(
                "assessments",
                queryset=Assessment.objects.select_related("item_type").order_by("start_offset", "ordering"),
            )
        )
        .prefetch_related(
            Prefetch("course_surveys", queryset=CourseSurvey.objects.order_by("start_offset", "ordering"))
        )
        .prefetch_related(Prefetch("course_relations", CourseRelation.objects.order_by("ordering")))
        .prefetch_related(Prefetch("course_categories", CourseCategory.objects.order_by("ordering")))
        .prefetch_related(Prefetch("course_certificates", CourseCertificate.objects.order_by("ordering")))
        .prefetch_related(Prefetch("course_instructors", CourseInstructor.objects.order_by("ordering")))
        .select_related("grading_policy")
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/course", response=str)
@editor_required()
@track_draft(Course)
async def save_course(
    request: HttpRequest,
    data: CourseSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    course_dict = data.model_dump(exclude_unset=True)
    course_id = course_dict.pop("id", None)
    grading_policy = course_dict.pop("grading_policy")

    if thumbnail:
        course_dict["thumbnail"] = thumbnail

    if course_id:
        course = await aget_object_or_404(Course, id=course_id, owner_id=request.auth)
        for key, value in course_dict.items():
            setattr(course, key, value)
        await course.asave()

    else:

        @sync_to_async()
        @transaction.atomic
        def create_new():
            try:
                course = Course.objects.create(**course_dict, owner_id=request.auth)
            except IntegrityError:
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return course

        course = await create_new()

    # created by trigger
    await GradingPolicy.objects.filter(course_id=course.id).aupdate(**grading_policy)

    return course.id


class CourseSurveySaveSpec(CourseSurveySpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/survey", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_surveys(request: HttpRequest, id: str, data: RootModel[list[CourseSurveySaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    course_surveys = await course.course_surveys.abulk_create(
        [
            CourseSurvey(course=course, ordering=i, **c)
            for i, c in enumerate({c["survey_id"]: c for c in data.model_dump()}.values())
        ],
        update_conflicts=True,
        unique_fields=["course_id", "survey_id"],
        update_fields=["label", "start_offset", "end_offset", "ordering"],
    )
    return [s.id for s in course_surveys]


@router.delete("/course/{id}/survey/{course_survey_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_survey(request: HttpRequest, id: str, course_survey_id: int):
    count, _ = await CourseSurvey.objects.filter(
        course_id=id, id=course_survey_id, course__owner_id=request.auth
    ).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class AssessmentSaveSpec(AssessmentSpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/assessment", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_assessments(request: HttpRequest, id: str, data: RootModel[list[AssessmentSaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)

    content_types = await asyncio.gather(*[
        sync_to_async(ContentType.objects.get_for_model)(M) for M in ASSESSIBLE_MODELS
    ])
    content_type_map = {(M._meta.app_label, M._meta.model_name): ct for M, ct in zip(ASSESSIBLE_MODELS, content_types)}

    deduped = {}
    for c in data.model_dump():
        if not c.get("id"):
            c["id"] = None

        item_type = c.pop("item_type")
        item_type_id = content_type_map[(item_type["app_label"], item_type["model"])].id
        c["item_type_id"] = item_type_id

        key = (c["item_id"], item_type_id)
        deduped[key] = c

    assessments = [Assessment(course=course, ordering=i, **c) for i, c in enumerate(deduped.values())]
    assessments = await course.assessments.abulk_create(
        assessments,
        update_conflicts=True,
        unique_fields=["course_id", "item_id", "item_type_id"],
        update_fields=["label", "weight", "start_offset", "end_offset", "ordering"],
    )
    return [s.id for s in assessments]


@router.delete("/course/{id}/assessment/{assessment_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_assessment(request: HttpRequest, id: str, assessment_id: int):
    count, _ = await Assessment.objects.filter(course_id=id, id=assessment_id, course__owner_id=request.auth).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class LessonSaveSpec(LessonSpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/lesson", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_lessons(request: HttpRequest, id: str, data: RootModel[list[LessonSaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    lessons, lesson_medias = [], []

    for i, lesson_data in enumerate(data.model_dump()):
        if not lesson_data["id"]:
            lesson_data["id"] = None

        media_ids = lesson_data.pop("media_ids")
        lesson = Lesson(course=course, ordering=i, **lesson_data)
        lessons.append(lesson)

        for j, media_id in enumerate(media_ids):
            lesson_medias.append(LessonMedia(lesson=lesson, media_id=media_id, ordering=j))

    @sync_to_async()
    @transaction.atomic
    def save_lessons():
        Lesson.objects.bulk_create(
            lessons,
            update_conflicts=True,
            unique_fields=["id"],
            update_fields=["label", "start_offset", "end_offset", "ordering"],
        )

        LessonMedia.objects.filter(lesson__course_id=id).delete()
        LessonMedia.objects.bulk_create(lesson_medias)

    try:
        await save_lessons()
    except (IntegrityError, DataError) as e:
        log.warning(e, exc_info=True)
        raise ValueError(ErrorCode.DATA_ERROR)
    except ProgrammingError as e:
        if "already exists in this course" in str(e):
            raise ValueError(ErrorCode.DATA_ERROR)
        raise

    return [le.id for le in lessons]


@router.delete("/course/{id}/lesson/{lesson_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_lesson(request: HttpRequest, id: str, lesson_id: int):
    count, _ = await Lesson.objects.filter(course_id=id, id=lesson_id, course__owner_id=request.auth).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class CourseCertificateSaveSpec(CourseCertificateSpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/certificate", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_certificates(request: HttpRequest, id: str, data: RootModel[list[CourseCertificateSaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    course_certificates = await course.course_certificates.abulk_create(
        [
            CourseCertificate(course=course, ordering=i, **c)
            for i, c in enumerate({c["certificate_id"]: c for c in data.model_dump()}.values())
        ],
        update_conflicts=True,
        unique_fields=["course_id", "certificate_id"],
        update_fields=["label", "ordering"],
    )
    return [c.id for c in course_certificates]


@router.delete("/course/{id}/certificate/{course_certificate_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_certificate(request: HttpRequest, id: str, course_certificate_id: int):
    count, _ = await CourseCertificate.objects.filter(
        course_id=id, id=course_certificate_id, course__owner_id=request.auth
    ).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class CourseRelationSaveSpec(CourseRelationSpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/relation", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_relations(request: HttpRequest, id: str, data: RootModel[list[CourseRelationSaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    course_relations = await course.course_relations.abulk_create(
        [
            CourseRelation(course=course, ordering=i, **c)
            for i, c in enumerate({c["related_course_id"]: c for c in data.model_dump()}.values())
        ],
        update_conflicts=True,
        unique_fields=["course_id", "related_course_id"],
        update_fields=["label", "ordering"],
    )
    return [c.id for c in course_relations]


@router.delete("/course/{id}/relation/{course_relation_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_relation(request: HttpRequest, id: str, course_relation_id: int):
    count, _ = await CourseRelation.objects.filter(
        course_id=id, id=course_relation_id, course__owner_id=request.auth
    ).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class CourseCategorySaveSpec(CourseCategorySpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/category", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_categories(request: HttpRequest, id: str, data: RootModel[list[CourseCategorySaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    course_categories = await course.course_categories.abulk_create(
        [
            CourseCategory(course=course, ordering=i, **c)
            for i, c in enumerate({c["category_id"]: c for c in data.model_dump()}.values())
        ],
        update_conflicts=True,
        unique_fields=["course_id", "category_id"],
        update_fields=["label", "ordering"],
    )
    return [c.id for c in course_categories]


@router.delete("/course/{id}/category/{course_category_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_category(request: HttpRequest, id: str, course_category_id: int):
    count, _ = await CourseCategory.objects.filter(
        course_id=id, id=course_category_id, course__owner_id=request.auth
    ).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)


class CourseInstructorSaveSpec(CourseInstructorSpec):
    id: Annotated[int, Field(None)]


@router.post("/course/{id}/instructor", response=list[int])
@editor_required()
@track_draft(Course, id_field="id")
async def save_course_instructors(request: HttpRequest, id: str, data: RootModel[list[CourseInstructorSaveSpec]]):
    course = await aget_object_or_404(Course, id=id, owner_id=request.auth)
    instructors = await course.course_instructors.abulk_create(
        [
            CourseInstructor(course=course, ordering=i, **c)
            for i, c in enumerate({c["instructor_id"]: c for c in data.model_dump()}.values())
        ],
        update_conflicts=True,
        unique_fields=["course_id", "instructor_id"],
        update_fields=["label", "lead", "ordering"],
    )
    return [i.id for i in instructors]


@router.delete("/course/{id}/instructor/{course_instructor_id}")
@editor_required()
@track_draft(Course, id_field="id")
async def remove_course_instructor(request: HttpRequest, id: str, course_instructor_id: int):
    count, _ = await CourseInstructor.objects.filter(
        course_id=id, id=course_instructor_id, course__owner_id=request.auth
    ).adelete()
    if count == 0:
        raise ValueError(ErrorCode.NOT_FOUND)
