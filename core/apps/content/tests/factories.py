import json
import tarfile
from datetime import timedelta
from pathlib import Path
from typing import Iterator, TypedDict
from uuid import uuid4

import mimesis
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.files.base import ContentFile
from django.utils import timezone
from factory.declarations import LazyAttribute, LazyFunction, SubFactory
from factory.helpers import lazy_attribute, post_generation

from apps.account.tests.factories import UserFactory
from apps.common.tests.factories import DjangoModelFactory, LearningObjectFactory, dummy_html, lazy_thumbnail
from apps.content.models import Media, Note, PublicAccessMedia, Subtitle, Watch

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


class VideoDict(TypedDict):
    title: str
    description: str
    duration: str
    license: str
    channel: str
    url: str
    thumbnail: str
    subtitles: list[SubtitleDict]


class SubtitleDict(TypedDict):
    lang: str
    body: str


_REAL_DATA: dict[str, VideoDict] = {}
_REAL_THUMBNAILS = {}
_DATA_ITER: Iterator[VideoDict] | None = None


def _load_real_data():
    global _REAL_DATA, _REAL_THUMBNAILS
    if _REAL_DATA:
        return

    base_path = Path(__file__).parent / "media"

    subtitle_map = {}
    with tarfile.open(base_path / "subtitle.tar.gz", "r:gz") as tar:
        subtitle_member = tar.getmember("subtitle.json")
        subtitle_file = tar.extractfile(subtitle_member)
        subtitle_data = json.load(subtitle_file) if subtitle_file else []

        for item in subtitle_data:
            if item["model"] == "content.subtitle":
                media_pk = item["fields"]["media"]
                if media_pk not in subtitle_map:
                    subtitle_map[media_pk] = []
                subtitle_map[media_pk].append({"lang": item["fields"]["lang"], "body": item["fields"]["body"]})

    with tarfile.open(base_path / "video.tar.gz", "r:gz") as tar:
        video_member = tar.getmember("video.json")
        video_file = tar.extractfile(video_member)
        video_data = json.load(video_file) if video_file else {}

        for item in video_data:
            if item["model"] == "content.media":
                media_pk = item["pk"]
                media_data = item["fields"]
                media_data["subtitles"] = subtitle_map.get(media_pk, [])
                _REAL_DATA[media_data["url"]] = media_data

    _REAL_THUMBNAILS = {}
    with tarfile.open(base_path / "thumbnail.tar.gz", "r:gz") as tar:
        for member in tar.getmembers():
            if member.isfile():
                content = tar.extractfile(member)
                if content:
                    file_data = content.read()
                    filename = Path(member.name).name
                    _REAL_THUMBNAILS[filename] = file_data


_load_real_data()

_CURRENT_DATA: VideoDict | None = None


def _get_next_real_data():
    global _DATA_ITER
    if _DATA_ITER is None:
        _DATA_ITER = iter(_REAL_DATA.values())
    return next(_DATA_ITER)


class MediaFactory(LearningObjectFactory[Media]):
    passing_point = 80
    max_attempts = 0
    verification_required = False
    owner = SubFactory(UserFactory)

    @classmethod
    def _generate(cls, strategy, params):
        global _CURRENT_DATA

        format = params.get("format")
        if format not in [Media.MediaFormatChoices.VIDEO, Media.MediaFormatChoices.PDF]:
            format = generic.random.weighted_choice({
                Media.MediaFormatChoices.VIDEO: 9,
                Media.MediaFormatChoices.PDF: 1,
            })

        if format == Media.MediaFormatChoices.VIDEO:
            _CURRENT_DATA = _get_next_real_data()

        params["format"] = format
        return super()._generate(strategy, params)

    @classmethod
    def _after_postgeneration(cls, instance, create, results=None):
        global _CURRENT_DATA
        _CURRENT_DATA = None
        return super()._after_postgeneration(instance, create, results)

    @lazy_attribute
    def title(self):
        if _CURRENT_DATA:
            return _CURRENT_DATA["title"]
        return generic.text.title()

    @lazy_attribute
    def description(self):
        if _CURRENT_DATA:
            return _CURRENT_DATA["description"]
        return generic.text.text(quantity=3)

    @lazy_attribute
    def duration(self):
        if _CURRENT_DATA:
            h, m, s = map(int, _CURRENT_DATA["duration"].split(":"))
            return timedelta(hours=h, minutes=m, seconds=s)
        return timedelta(minutes=generic.random.choice([10, 20, 30, 40]))

    @lazy_attribute
    def license(self):
        if _CURRENT_DATA:
            return _CURRENT_DATA["license"]
        return ""

    @lazy_attribute
    def channel(self):
        if _CURRENT_DATA:
            return _CURRENT_DATA["channel"]
        return ""

    @lazy_attribute
    def url(self):
        if _CURRENT_DATA:
            return _CURRENT_DATA["url"]
        return staticfiles_storage.url(f"sample/sample.pdf?p={uuid4().hex}")

    @lazy_attribute
    def thumbnail(self):
        if _CURRENT_DATA:
            thumbnail_name = _CURRENT_DATA["thumbnail"]
            thumbnail_data = _REAL_THUMBNAILS[thumbnail_name]
            return ContentFile(thumbnail_data, thumbnail_name)
        return lazy_thumbnail()

    class Meta:
        model = Media
        django_get_or_create = ("url",)
        skip_postgeneration_save = True

    @post_generation
    def process_subtitles(self, create: bool, extracted: object, **kwargs: object):
        if not create:
            return

        if not _CURRENT_DATA:
            return

        for subtitle in _CURRENT_DATA.get("subtitles", []):
            Subtitle.objects.get_or_create(media=self, lang=subtitle["lang"], defaults={"body": subtitle["body"]})

    @post_generation
    def post_generation(self, create: bool, extracted: bool, **kwargs: object):
        if not create or extracted is False:
            return

        WatchFactory.create(user=self.owner, media=self)
        NoteFactory.create(user=self.owner, media=self)


class PublicAccessMediaFactory(DjangoModelFactory[PublicAccessMedia]):
    media = SubFactory(MediaFactory)
    start = LazyFunction(lambda: timezone.now())
    end = LazyFunction(lambda: timezone.now() + timedelta(days=30))
    archive = LazyFunction(lambda: timezone.now() + timedelta(days=60))

    class Meta:
        model = PublicAccessMedia
        django_get_or_create = ("media",)


WATCH = "1"
UNWATCH = "0"


class WatchFactory(DjangoModelFactory[Watch]):
    user = SubFactory(UserFactory)
    media = SubFactory(MediaFactory)

    class Meta:
        model = Watch
        django_get_or_create = ("user", "media")

    @lazy_attribute
    def watch_bits(self: Watch):
        bits = UNWATCH * int(self.media.duration.total_seconds())
        return bits.replace(UNWATCH, WATCH, generic.random.randint(0, len(bits) - 1))

    last_position = LazyAttribute(lambda o: o.watch_bits.count(WATCH))

    @lazy_attribute
    def rate(self):
        watch_bits = str(self.watch_bits)
        return watch_bits.count(WATCH) / len(watch_bits) * 100.0


class NoteFactory(DjangoModelFactory[Note]):
    user = SubFactory(UserFactory)
    media = SubFactory(MediaFactory)
    note = LazyFunction(lambda: dummy_html())

    class Meta:
        model = Note
        django_get_or_create = ("user", "media")
