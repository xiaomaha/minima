from collections import defaultdict
from typing import Annotated

from asgiref.sync import sync_to_async
from django.apps import apps
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.db.models import F, Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import HttpUrl

from apps.common.error import ErrorCode
from apps.common.schema import FileSizeValidator, FileTypeValidator, LearningObjectMixinSchema, Schema
from apps.common.util import HttpRequest
from apps.course.models import Assessment, Course, CourseSurvey, Lesson, LessonMedia
from apps.operation.models import HonorCode
from apps.studio.api.v1.schema import HonorCodeSpec, OwnerSpec
from apps.studio.decorator import editor_required
from apps.studio.models import Draft


class CourseSpec(LearningObjectMixinSchema):
    id: str
    objective: str
    preview_url: str | None
    effort_hours: int
    level: Course.LevelChoices
    owner: OwnerSpec
    honor_code: HonorCodeSpec


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
    honor_code: HonorCodeSpec


class CourseSurveySpec(Schema):
    id: int
    survey_id: str
    survey_title: str
    start_offset: int
    end_offset: int | None


class CourseLessonSpec(Schema):
    class CourseLessonMediaSpec(Schema):
        id: int
        media_title: str
        media_id: str
        ordering: int

    id: int
    title: str
    description: str
    medias: list[CourseLessonMediaSpec]
    start_offset: int
    end_offset: int | None

    @staticmethod
    def resolve_medias(obj: Lesson):
        return obj.lessonmedia_set.all()


class CourseAssessmentSpec(Schema):
    id: int
    item_id: str
    item_title: str
    item_app_label: str
    item_model: str
    weight: int
    start_offset: int
    end_offset: int | None


class CourseStructureSpec(Schema):
    surveys: list[CourseSurveySpec]
    lessons: list[CourseLessonSpec]
    assessments: list[CourseAssessmentSpec]

    @staticmethod
    def resolve_surveys(obj: Course):
        return obj.coursesurvey_set.all()

    @staticmethod
    def resolve_lessons(obj: Course):
        return obj.lesson_set.all()

    @staticmethod
    def resolve_assessments(obj: Course):
        return obj.assessment_set.all()


router = Router(by_alias=True)


@router.get("/course/{id}", response=CourseSpec)
@editor_required()
async def get_course(request: HttpRequest, id: str):
    return await Course.objects.select_related("owner", "honor_code").aget(id=id, owner_id=request.auth)


@router.post("/course", response=str)
@editor_required()
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
    honor_code = course_dict.pop("honor_code")

    if thumbnail:
        course_dict["thumbnail"] = thumbnail

    if course_id:
        course = await aget_object_or_404(Course, id=course_id, owner_id=request.auth)
        for key, value in course_dict.items():
            setattr(course, key, value)
        await course.asave()
        await HonorCode.objects.filter(id=course.honor_code_id).aupdate(**honor_code)

    else:

        @sync_to_async()
        @transaction.atomic
        def create_new():
            code = HonorCode.objects.create(**honor_code)
            try:
                course = Course.objects.create(**course_dict, honor_code=code, owner_id=request.auth)
            except IntegrityError:
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return course

        course = await create_new()

    content_type = await sync_to_async(ContentType.objects.get_for_model)(Course)
    await Draft.objects.aupdate_or_create(
        content_type=content_type, content_id=course.id, defaults={"author_id": request.auth}
    )

    return course.id


@router.get("/course/{id}/structure", response=CourseStructureSpec)
@editor_required()
async def course_structure(request: HttpRequest, id: str):
    course = (
        await Course.objects
        .prefetch_related(
            Prefetch(
                "coursesurvey_set",
                queryset=CourseSurvey.objects.annotate(survey_title=F("survey__title")).order_by("start_offset"),
            )
        )
        .prefetch_related(
            Prefetch(
                "lesson_set",
                queryset=Lesson.objects.prefetch_related(
                    Prefetch(
                        "lessonmedia_set",
                        queryset=LessonMedia.objects.annotate(media_title=F("media__title")).order_by("ordering"),
                    )
                ).order_by("start_offset"),
            )
        )
        .prefetch_related(
            Prefetch(
                "assessment_set",
                queryset=Assessment.objects.annotate(
                    item_app_label=F("item_type__app_label"), item_model=F("item_type__model")
                ).order_by("start_offset"),
            )
        )
        .aget(id=id, owner_id=request.auth)
    )

    assessments = list(course.assessment_set.all())
    type_to_ids: dict[tuple[str, str], list[str]] = defaultdict(list)
    for a in assessments:
        type_to_ids[(a.item_app_label, a.item_model)].append(a.item_id)

    qs_list = [
        apps.get_model(app_label, model).objects.filter(id__in=ids).values("id", "title")
        for (app_label, model), ids in type_to_ids.items()
    ]
    if qs_list:
        union_qs = qs_list[0].union(*qs_list[1:]) if len(qs_list) > 1 else qs_list[0]
        titles = {row["id"]: row["title"] async for row in union_qs}
        for a in assessments:
            a.item_title = titles.get(a.item_id, "")

    return course
