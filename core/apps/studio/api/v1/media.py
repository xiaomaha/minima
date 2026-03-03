from datetime import timedelta
from typing import Annotated

from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions

from apps.common.error import ErrorCode
from apps.common.schema import FileSizeValidator, FileTypeValidator, LearningObjectMixinSchema, Schema
from apps.common.util import HttpRequest
from apps.content.models import Media, Subtitle
from apps.studio.decorator import editor_required, track_draft


class SubtitleSpec(Schema):
    lang: str
    body: str


class MediaSpec(LearningObjectMixinSchema):
    id: str
    thumbnail: str
    format: Media.MediaFormatChoices
    license: str
    channel: str
    duration_seconds: float
    url: str
    quizzes: list[str]
    subtitles: list[SubtitleSpec]

    @staticmethod
    def resolve_quizzes(obj: Media):
        return [q.pk for q in obj.quizzes.all()]

    @staticmethod
    def resolve_subtitles(obj: Media):
        return [s for s in obj.subtitles.all()]


class MediaSaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    duration_seconds: float
    passing_point: int
    format: Media.MediaFormatChoices
    url: str
    quizzes: list[str]


router = Router(by_alias=True)


@router.get("/media/{id}", response=MediaSpec)
@editor_required()
async def get_media(request: HttpRequest, id: str):
    return await Media.objects.prefetch_related("subtitles", "quizzes").aget(id=id, owner_id=request.auth)


@router.post("/media", response=str)
@editor_required()
@track_draft(Media)
async def save_media(
    request: HttpRequest,
    data: MediaSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    media_dict = data.model_dump(exclude_unset=True)
    media_id = media_dict.pop("id", None)
    quiz_ids = set(media_dict.pop("quizzes", []))
    media_dict["duration"] = timedelta(seconds=media_dict.pop("duration_seconds"))

    if thumbnail:
        media_dict["thumbnail"] = thumbnail

    if media_id:
        media = await aget_object_or_404(
            Media.objects.annotate(quiz_ids=ArrayAgg("quizzes__id", filter=Q(quizzes__id__isnull=False), default=[])),
            id=media_id,
            owner_id=request.auth,
        )
        for key, value in media_dict.items():
            setattr(media, key, value)
        await media.asave()

        if quiz_ids == set(media.quiz_ids):
            quiz_ids = None

    else:
        media = await Media.objects.acreate(**media_dict, owner_id=request.auth)
        if not quiz_ids:
            quiz_ids = None

    if quiz_ids is not None:
        try:
            await media.quizzes.aset(quiz_ids)
        except IntegrityError:
            raise ValueError(ErrorCode.QUIZ_NOT_FOUND)

    return media.id


@router.post("/media/{id}/subtitle")
@editor_required()
@track_draft(Media, id_field="id")
async def save_media_subtitle(request, id: str, data: SubtitleSpec):
    media = await aget_object_or_404(Media, id=id, owner_id=request.auth)
    await Subtitle.objects.aupdate_or_create(media=media, lang=data.lang, defaults={"body": data.body})


@router.delete("/media/{id}/subtitle/{lang}")
@editor_required()
@track_draft(Media, id_field="id")
async def delete_media_subtitle(request: HttpRequest, id: str, lang: str):
    count, _ = await Subtitle.objects.filter(lang=lang, media_id=id, media__owner_id=request.auth).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)


@router.post("/media/{id}/subtitle/{lang}/quiz", response=str)
@editor_required()
@track_draft(Media, id_field="id")
async def create_media_quiz(request, id: str, lang: str):
    media = await aget_object_or_404(Media, id=id, owner_id=request.auth)
    quiz = await media.create_quiz(lang_code=lang)
    return quiz.pk
