import tarfile
from itertools import cycle
from pathlib import Path

import mimesis
from django.conf import settings
from django.core.files.base import ContentFile
from factory.declarations import LazyFunction
from factory.django import DjangoModelFactory
from mimesis.plugins.factory import FactoryField

from apps.common.models import GradeFieldMixin, GradeWorkflowMixin, LearningObjectMixin

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


def load_images_from_tar(tar_path):
    images = []
    with tarfile.open(tar_path, "r:gz") as tar:
        for member in tar.getmembers():
            filename = member.name.split("/")[-1]
            if member.isfile() and (filename.startswith("thumbnail_") or filename.startswith("avatar_")):
                content = tar.extractfile(member)
                if content:
                    images.append(content.read())
    return images


TESTS_DIR = Path(__file__).parent
THUMBNAIL_IMAGES = cycle(load_images_from_tar(TESTS_DIR / "thumbnail.tar.gz"))
AVATAR_IMAGES = cycle(load_images_from_tar(TESTS_DIR / "avatar.tar.gz"))


def lazy_thumbnail():
    img = next(THUMBNAIL_IMAGES)
    return ContentFile(img, f"thumb_{generic.random.randint(1000, 9999)}.jpg")


def lazy_avatar():
    img = next(AVATAR_IMAGES)
    return ContentFile(img, f"avatar_{generic.random.randint(1000, 9999)}.jpg")


class LearningObjectFactory[T: LearningObjectMixin](DjangoModelFactory[T]):
    title = LazyFunction(lambda: " ".join(generic.text.words(generic.random.randint(3, 6))))
    description = FactoryField("text", quantity=generic.random.randint(1, 3))
    audience = FactoryField("text", quantity=generic.random.randint(1, 3))
    thumbnail = LazyFunction(lazy_thumbnail)
    featured = LazyFunction(lambda: generic.random.weighted_choice({True: 1, False: 9}))

    class Meta:
        abstract = True


class GradeFieldFactory[T: GradeFieldMixin](DjangoModelFactory[T]):
    feedback = {}
    completed = None
    confirmed = None

    class Meta:
        abstract = True


class GradeWorkflowFactory[T: GradeWorkflowMixin](DjangoModelFactory[T]):
    grade_due_days = 7
    appeal_deadline_days = 3
    confirm_due_days = 3

    class Meta:
        abstract = True


def dummy_html():
    html_type = generic.random.choice(["paragraph", "list", "table"])

    if html_type == "paragraph":
        paragraphs = generic.random.randint(1, 2)
        return "".join(f"<p>{generic.text.text(quantity=2)}</p>" for _ in range(paragraphs))
    elif html_type == "list":
        items = "".join(f"<li>{generic.text.sentence()}</li>" for _ in range(generic.random.randint(2, 4)))
        return f"<ul>{items}</ul>"
    else:
        rows = "".join(
            f"<tr><td>{generic.text.word()}</td><td>{generic.text.sentence()}</td></tr>"
            for _ in range(generic.random.randint(2, 3))
        )

        return f'<table class="table"><tbody>{rows}</tbody></table>'
