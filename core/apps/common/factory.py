import io
from pathlib import Path

import mimesis
from django.conf import settings
from django.core.files.base import ContentFile
from factory.declarations import LazyFunction
from factory.django import DjangoModelFactory
from mimesis.plugins.factory import FactoryField
from PIL import Image

from apps.common.models import GradeFieldMixin, GradeWorkflowMixin, LearningObjectMixin

generic = mimesis.Generic(settings.DEFAULT_LANGUAGE)


BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(settings.BASE_DIR) / ".cache" / "test_images"


def generate_dummy_image(width, height, index):
    img = Image.new("RGB", (width, height))
    from PIL import ImageDraw

    draw = ImageDraw.Draw(img)

    r = (index * 37) % 256
    g = (index * 73) % 256
    b = (index * 139) % 256

    for i in range(height):
        color = (r, int(g * (1 - i / height)), b)
        draw.rectangle([(0, i), (width, i + 1)], fill=color)

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return buffer.getvalue()


def ensure_test_images(prefix, size, count=100):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    images = list(CACHE_DIR.glob(f"{prefix}_*.jpg"))

    if images:
        return images

    width, height = map(int, size.split("x"))

    for i in range(count):
        img_path = CACHE_DIR / f"{prefix}_{i}.jpg"
        img_path.write_bytes(generate_dummy_image(width, height, i))

    return list(CACHE_DIR.glob(f"{prefix}_*.jpg"))


FIXTURE_IMAGES = ensure_test_images("thumb", "800x600")
FIXTURE_AVATARS = ensure_test_images("avatar", "200x200")


def lazy_thumbnail():
    return ContentFile(
        generic.random.choice(FIXTURE_IMAGES).read_bytes(), f"thumb_{generic.random.randint(1000, 9999)}.jpg"
    )


def lazy_avatar():
    return ContentFile(
        generic.random.choice(FIXTURE_AVATARS).read_bytes(), f"avatar_{generic.random.randint(1000, 9999)}.jpg"
    )


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
