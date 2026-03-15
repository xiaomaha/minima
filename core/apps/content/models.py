import logging
import re
from datetime import date, datetime, time, timedelta
from io import StringIO
from typing import TYPE_CHECKING, Literal, Sequence

import pghistory
import webvtt
from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files import File
from django.core.files.base import ContentFile
from django.db import connection
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.models import (
    CASCADE,
    BooleanField,
    Case,
    CharField,
    Count,
    DateTimeField,
    DurationField,
    Exists,
    F,
    Field,
    FloatField,
    ForeignKey,
    Func,
    ImageField,
    Index,
    IntegerField,
    ManyToManyField,
    Model,
    OneToOneField,
    OuterRef,
    Prefetch,
    QuerySet,
    TextChoices,
    TextField,
    UniqueConstraint,
    URLField,
    Value,
    When,
)
from django.db.models.functions import Replace
from django.utils import timezone
from django.utils.translation import get_language_info
from django.utils.translation import gettext_lazy as _
from webvtt.errors import MalformedFileError

from apps.common.error import ErrorCode
from apps.common.models import LearningObjectMixin, TimeStampedMixin
from apps.common.util import PaginationDict, offset_paginate
from apps.operation.models import AttachmentMixin
from apps.quiz.models import Quiz

User = get_user_model()

log = logging.getLogger(__name__)


WATCH = "1"


class VarBitField(Field):
    def db_type(self, connection: BaseDatabaseWrapper):
        return "varbit"


@pghistory.track()
class Media(LearningObjectMixin):
    class MediaFormatChoices(TextChoices):
        VIDEO = "video", _("Video")
        SHORT = "short", _("Short")
        EBOOK = "ebook", _("Ebook")
        HTML = "html", _("HTML")
        PDF = "pdf", _("PDF")
        LIVE = "live", _("Live")

    thumbnail = ImageField(_("Thumbnail"))
    owner = ForeignKey(User, CASCADE, verbose_name=_("Owner"))
    format = CharField(_("Format"), max_length=30, choices=MediaFormatChoices.choices)
    duration = DurationField(_("Duration"))
    license = CharField(_("License"), max_length=255, blank=True, default="")
    channel = CharField(_("Channel"), max_length=255, blank=True, default="")
    url = URLField(_("URL"), max_length=500, unique=True)
    quizzes = ManyToManyField(Quiz, through="MediaQuiz", blank=True, verbose_name=_("Quizzes"))

    class Meta(LearningObjectMixin.Meta):
        verbose_name = _("Media")
        verbose_name_plural = _("Medias")

    if TYPE_CHECKING:
        pk: str
        subtitles: "QuerySet[Subtitle]"
        owner_id: str
        open: datetime  # annotated
        quiz_ids: list[str]  # annotated

    @property
    def duration_seconds(self):
        return self.duration.total_seconds()

    @classmethod
    def annotate_accessible(cls):
        now = timezone.now()
        return cls.objects.annotate(
            accessible=Case(
                When(public_access__start__lte=now, public_access__archive__gte=now, then=True),
                default=False,
                output_field=BooleanField(),
            )
        )

    @classmethod
    async def get_media(cls, id: str):
        return (
            await cls.objects
            .prefetch_related(
                Prefetch(
                    "quizzes",
                    queryset=Quiz.objects.annotate(question_count=F("question_pool__select_count")).only(
                        "id", "title", "description", "passing_point"
                    ),
                )
            )
            .annotate(subtitle_count=Count("subtitles"))
            .select_related("owner")
            .aget(id=id)
        )

    @classmethod
    async def search(cls, *, q: str, page: int, size: int, filter: Literal["public", "all"]):
        from apps.content.documents import document_search

        qs = cls.annotate_accessible().select_related("owner")
        if filter == "public":
            qs = qs.filter(public_access__start__lte=timezone.now(), public_access__archive__gte=timezone.now())

        if not q:
            searched = None
            paginated = await offset_paginate(qs, page=page, size=size)
        else:
            # document search
            searched = await sync_to_async(document_search)(q=q, page=page, size=size)
            paginated: PaginationDict = {
                "items": [m async for m in qs.filter(id__in=searched["lines"].keys())],
                "count": searched["count"],
                "size": size,
                "page": page,
                "pages": searched["pages"],
            }

        for media in paginated["items"]:
            media.matched_lines = searched["lines"][media.pk] if searched else None

        return paginated

    MIN_QUESTIONS = 5
    MAX_QUESTIONS = 30
    MINUTES_PER_QUESTION = 3

    async def create_quiz(self, *, lang_code: str = settings.DEFAULT_LANGUAGE):
        subtitle = (
            await Subtitle.objects
            .annotate(quiz_exist=Exists(MediaQuiz.objects.filter(media_id=OuterRef("media_id"), lang=lang_code)))
            .select_related("media")
            .filter(media_id=self.pk)
            .order_by(Case(When(lang=lang_code, then=Value(0)), default=Value(1), output_field=IntegerField()))
            .afirst()
        )

        if not subtitle:
            raise ValueError(ErrorCode.NOT_FOUND)

        if subtitle.quiz_exist:
            raise ValueError(ErrorCode.ALREADY_EXISTS)

        media = subtitle.media
        title = f"{media.title} - {get_language_info('ko')['name_local']}"

        if await Quiz.objects.filter(title=title, owner_id=media.owner_id).aexists():
            raise ValueError(ErrorCode.ALREADY_EXISTS)

        text = subtitle.get_plain_text()
        if not text or len(text) < 300:
            raise ValueError(ErrorCode.INSUFFICIENT_CONTENT)

        def _calculate_question_count(duration: timedelta) -> int:
            total_minutes = int(duration.total_seconds() / 60)
            count = total_minutes // self.MINUTES_PER_QUESTION
            return max(self.MIN_QUESTIONS, min(count, self.MAX_QUESTIONS))

        thumbnail = None
        if media.thumbnail:
            thumbnail = ContentFile(media.thumbnail.read())
            thumbnail.name = media.thumbnail.name

        quiz = await Quiz.create_quiz(
            title=title,
            description=media.description,
            audience=media.audience,
            thumbnail=media.thumbnail,
            owner_id=media.owner_id,
            text=subtitle.get_plain_text(),
            question_count=_calculate_question_count(media.duration),
            lang_code=lang_code,
        )

        await MediaQuiz.objects.acreate(media=media, quiz=quiz, lang=lang_code)

        return quiz

    @classmethod
    async def content_inline_access(cls, *, media_id: str, content_id: str, app_label: str, model: str):
        if app_label == Quiz._meta.app_label and model == Quiz._meta.model_name:
            if await cls.objects.filter(id=media_id, quizzes__id=content_id).aexists():
                return
        raise ValueError(ErrorCode.CONTENT_NOT_AVAILABLE)


@pghistory.track()
class MediaQuiz(Model):
    media = ForeignKey(Media, CASCADE, related_name="media_quizzes", verbose_name=_("Media"))
    quiz = ForeignKey(Quiz, CASCADE, verbose_name=_("Quiz"))
    lang = CharField(_("Language"), max_length=30, null=True, blank=True)

    class Meta:
        constraints = [UniqueConstraint(fields=["media", "quiz", "lang"], name="content_media_quiz_me_qu_la_uniq")]
        verbose_name = _("Media Quiz")
        verbose_name_plural = _("Media Quizzes")


@pghistory.track()
class PublicAccessMedia(TimeStampedMixin):
    media = OneToOneField(Media, CASCADE, related_name="public_access", verbose_name=_("Media"))
    start = DateTimeField(_("Start"), default=timezone.now)
    end = DateTimeField(_("End"))
    archive = DateTimeField(_("Archive"))

    class Meta:
        verbose_name = _("Public Access Media")
        verbose_name_plural = _("Public Access Medias")

    @classmethod
    async def get_access_date(cls, *, media_id: str):
        now = timezone.now()
        return await cls.objects.filter(media_id=media_id, start__lte=now, archive__gte=now).afirst()


@pghistory.track()
class Subtitle(Model):
    media = ForeignKey(Media, CASCADE, related_name="subtitles", verbose_name=_("Media"))
    lang = CharField(_("Language"), max_length=10)
    body = TextField(_("Body"))

    class Meta:
        constraints = [UniqueConstraint(fields=["media", "lang"], name="content_subtitle_me_la_uniq")]
        verbose_name = _("Subtitle")
        verbose_name_plural = _("Subtitles")

    if TYPE_CHECKING:
        quiz_exist: bool  # annotated

    def clean_body(self):
        if not (body := self.body.strip()):
            return body

        f = StringIO(body)
        for fmt in ["vtt", "srt", "sbv"]:
            try:
                captions = webvtt.from_buffer(f, format=fmt)
                return captions.content
            except MalformedFileError:
                f.seek(0)

        raise ValidationError(_("Invalid subtitle format"))

    def get_plain_text(self):
        lines = self.body.split("\n")
        text_lines = []

        for line in lines:
            line = line.strip()

            if not line:
                continue
            if line.startswith("WEBVTT"):
                continue
            if "-->" in line:
                continue
            if re.match(r"^\d+$", line):
                continue

            line = re.sub(r"<[^>]+>", "", line)
            line = re.sub(r"\s+", " ", line)

            if line and line not in text_lines[-3:]:
                text_lines.append(line)

        return "\n".join(text_lines)


@pghistory.track(exclude=["last_position"])
class Watch(TimeStampedMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    media = ForeignKey(Media, CASCADE, verbose_name=_("Media"))
    last_position = FloatField(_("Last Position"))
    watch_bits = VarBitField(_("Watch Bits"), blank=True, null=True)
    rate = FloatField(_("Watch Rate"))
    passed = BooleanField(_("Passed"), default=False)
    context = CharField(_("Context Key"), max_length=255, blank=True, default="")

    class Meta(TimeStampedMixin.Meta):
        constraints = [UniqueConstraint(fields=["user", "media", "context"], name="content_watch_us_me_co_ke_uniq")]
        verbose_name = _("Watch")
        verbose_name_plural = _("Watches")
        indexes = [Index(fields=["user_id", "context"])]

    if TYPE_CHECKING:
        pk: int
        media_id: str
        duration: timedelta  # annotated
        thumbnail: str  # annotated
        normalized_context: str  # annotated

    @classmethod
    async def update_media_watch(
        cls, *, media_id: str, user_id: str, context: str, last_position: float, watch_bits: str | None
    ):
        def _execute_update():
            if watch_bits is None:
                cls.objects.update_or_create(
                    media_id=media_id, user_id=user_id, context=context, defaults={"last_position": last_position}
                )
                return

            if not watch_bits or set(watch_bits) - {"0", "1"}:
                raise ValueError("watch_bits must be a non-empty bit string")

            bit_length = len(watch_bits)
            bit_count = watch_bits.count(WATCH)

            table = cls._meta.db_table
            media_table = Media._meta.db_table

            sql = f"""
                WITH
                input_bits AS (
                    SELECT '{watch_bits}'::varbit AS bits
                ),
                media_info AS (
                    SELECT passing_point FROM {media_table} WHERE id = %(media_id)s
                ),
                existing AS (
                    SELECT watch_bits FROM {table} WHERE user_id = %(user_id)s AND media_id = %(media_id)s AND context = %(context)s
                ),
                merged AS (
                    SELECT
                        CASE
                            WHEN e.watch_bits IS NULL THEN
                                i.bits
                            WHEN LENGTH(e.watch_bits) < %(bit_length)s THEN
                                RPAD(e.watch_bits::text, %(bit_length)s, '0')::varbit | i.bits
                            WHEN LENGTH(e.watch_bits) > %(bit_length)s THEN
                                SUBSTRING(e.watch_bits, 1, %(bit_length)s) | i.bits
                            ELSE
                                e.watch_bits | i.bits
                        END AS bits
                    FROM input_bits i
                    LEFT JOIN existing e ON true
                ),
                final AS (
                    SELECT bits, BIT_COUNT(bits) AS bit_count FROM merged
                )
                INSERT INTO {table} (
                    user_id, media_id, context, watch_bits, rate, passed, last_position, created, modified
                )
                VALUES (
                    %(user_id)s,
                    %(media_id)s,
                    %(context)s,
                    (SELECT bits FROM input_bits),
                    %(rate)s,
                    %(rate)s >= (SELECT passing_point FROM media_info),
                    %(last_position)s,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (user_id, media_id, context)
                DO UPDATE SET
                    watch_bits = (SELECT bits FROM final),
                    rate = (SELECT bit_count FROM final) * 100.0 / %(bit_length)s,
                    passed = ((SELECT bit_count FROM final) * 100.0 / %(bit_length)s) >= (SELECT passing_point FROM media_info),
                    last_position = EXCLUDED.last_position,
                    modified = NOW();
            """

            params = {
                "media_id": media_id,
                "user_id": user_id,
                "context": context,
                "last_position": last_position,
                # "watch_bits": watch_bits, # large data, to avoid repeating leteral data, use f-string
                "rate": bit_count * 100.0 / bit_length,
                "bit_length": bit_length,
            }

            with connection.cursor() as cursor:
                cursor.execute(sql, params)

        await sync_to_async(_execute_update, thread_sensitive=True)()

    @classmethod
    async def get_watched_public_medias(cls, *, user_id: str, start: date | None = None, end: date | None = None):
        now = timezone.now()
        # limit to public accessible
        qs = Watch.objects.filter(
            user_id=user_id, media__public_access__start__lte=now, media__public_access__archive__gte=now
        )
        if start and end:
            start_dt = timezone.make_aware(datetime.combine(start, time.min))
            end_dt = timezone.make_aware(datetime.combine(end, time.max))
            qs = qs.filter(created__range=(start_dt, end_dt))
        elif start:
            start_dt = timezone.make_aware(datetime.combine(start, time.min))
            qs = qs.filter(created__gte=start_dt)
        elif end:
            end_dt = timezone.make_aware(datetime.combine(end, time.max))
            qs = qs.filter(created__lte=end_dt)

        return (
            qs
            .annotate(
                # cf.common.util.normalize_context
                normalized_context=Case(
                    When(context="", then=Value("")),
                    default=Replace(
                        Func(
                            F("context"),
                            Value("^([^:]+::[^:]+)::.*"),
                            Value("\\1"),
                            function="regexp_replace",
                            output_field=CharField(),
                        ),
                        Value("::"),
                        Value("="),
                    ),
                ),
                title=F("media__title"),
                thumbnail=F("media__thumbnail"),
                format=F("media__format"),
                duration=F("media__duration"),
                passing_point=F("media__passing_point"),
                url=F("media__url"),
            )
            .order_by("media_id", "normalized_context", "-created")
            .distinct("media_id", "normalized_context")
        )


@pghistory.track()
class Note(TimeStampedMixin, AttachmentMixin):
    user = ForeignKey(User, CASCADE, verbose_name=_("User"))
    media = ForeignKey(Media, CASCADE, verbose_name=_("Media"))
    note = TextField(verbose_name=_("Note"))
    context = CharField(_("Context Key"), max_length=255, blank=True, default="")

    class Meta(TimeStampedMixin.Meta, AttachmentMixin.Meta):
        constraints = [UniqueConstraint(fields=["user", "media", "context"], name="content_note_us_me_co_keuniq")]
        verbose_name = _("Note")
        verbose_name_plural = _("Notes")

    if TYPE_CHECKING:
        pk: int

    @property
    def cleaned_note(self):
        return self.update_attachment_urls(content=self.note)

    @classmethod
    async def upsert(cls, *, user_id: str, media_id: str, context: str, note: str, files: Sequence[File] | None):
        note_, created = await cls.objects.aupdate_or_create(
            user_id=user_id, media_id=media_id, context=context, defaults={"note": note}
        )
        await note_.update_attachments(files=files, owner_id=user_id, content=note_.note)
        return note_
