import itertools
import json
import os
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.conf import settings
from django.contrib.auth.models import Group as DJangoGroup
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.translation import get_language_info
from django.utils.translation import gettext as _
from mimesis.plugins.factory import FactoryField

from apps.account.models import User
from apps.assignment.models import Assignment
from apps.content.models import Media, MediaQuiz, PublicAccessMedia
from apps.content.tests.factories import _REAL_DATA, MediaFactory
from apps.discussion.models import Discussion
from apps.exam.models import Exam
from apps.learning.models import CatalogItem
from apps.learning.tests.factories import CatalogFactory, CohortCatalogFactory, UserCatalogFactory
from apps.operation.tests.factories import AnnouncementFactory, InquiryFactory, PolicyFactory
from apps.partner.models import CohortMember, Group
from apps.partner.tests.factories import CohortFactory, MemberFactory, PartnerFactory
from apps.quiz.models import Quiz
from apps.tutor.models import Allocation


class Command(BaseCommand):
    help = "Setup demo datalog"

    def handle(self, *args, **options):
        # test user
        test_user = User.objects.get(email=os.environ.get("DJANGO_SUPERUSER_EMAIL") or "admin@example.com")

        # add group
        test_user.groups.set(DJangoGroup.objects.all())

        # public catalog
        self.create_public_catalog(f"{_('Demo Public Catalog')} 1", 30)

        personal_catalog = CatalogFactory.create(
            name=_("Demo Personal Catalog"),
            description=_(
                "Personal catalogs are available only to you. "
                "Video, PDF, Survey, Quiz, Assignment, Discussion, and Exam content are available here."
            ),
            active=True,
            public=False,
        )
        UserCatalogFactory.create(user=test_user, catalog=personal_catalog)

        # cohort catalog

        cohort_catalog = CatalogFactory.create(
            name=_("Demo Cohort Catalog"),
            description=_(
                "Cohort catalogs are available when you are in a cohort. "
                "Video, PDF, Survey, Quiz, Assignment, Discussion, and Exam content are available here."
            ),
            active=True,
            public=False,
        )

        # partner, group, member, cohort
        partner = PartnerFactory.create()
        group = Group.objects.filter(partner=partner).first()
        if not group:
            raise ImproperlyConfigured("No group found for partner")

        member = MemberFactory.create(group=group, email=test_user.email, user=test_user)
        cohort = CohortFactory.create()
        CohortMember.objects.create(cohort=cohort, member=member)

        CohortCatalogFactory.create(cohort=cohort, catalog=cohort_catalog)

        # public catalog again
        self.create_public_catalog(f"{_('Demo Public Catalog')} 2", 24)

        # all the rest video content

        remains = len(_REAL_DATA) - Media.objects.filter(format=Media.MediaFormatChoices.VIDEO).count()
        if remains > 0:
            new_medias = MediaFactory.create_batch(
                size=remains, format=Media.MediaFormatChoices.VIDEO, owner=test_user, post_generation=False
            )

            start = timezone.now()
            PublicAccessMedia.objects.bulk_create(
                [
                    PublicAccessMedia(
                        media=media, start=start, end=start + timedelta(days=30), archive=start + timedelta(days=60)
                    )
                    for media in new_medias
                ],
                ignore_conflicts=True,
            )

        # create inline quizzes

        with open("apps/quiz/tests/quiz_data.json") as f:
            quiz_data_cycle = itertools.cycle(json.load(f))

            media_quiz = []
            for i, media in enumerate(Media.objects.filter(quizzes__isnull=True)):
                quiz_data = next(quiz_data_cycle)

                thumbnail = None
                if media.thumbnail:
                    thumbnail = ContentFile(media.thumbnail.read())
                    thumbnail.name = media.thumbnail.name

                quiz = async_to_sync(Quiz.create_quiz)(
                    title=f"{media.title} {i + 1} - {get_language_info('en')['name_local']}",
                    description=media.description,
                    audience=media.audience,
                    thumbnail=media.thumbnail,
                    owner_id=media.owner_id,
                    text="",
                    question_count=len(quiz_data["questions"]),
                    lang_code="en",
                    quiz_data=quiz_data,
                )
                media_quiz.append(MediaQuiz(media=media, quiz=quiz, lang="en"))

            MediaQuiz.objects.bulk_create(media_quiz, ignore_conflicts=True)

        # announcement
        AnnouncementFactory.create_batch(size=50)

        # inquery
        InquiryFactory.create_batch(size=5, writer=test_user, content=test_user)

        # site policy
        with FactoryField.override_locale(settings.DEFAULT_LANGUAGE):
            PolicyFactory.create_batch(5)

        # tutor allocation
        exams = [Allocation(tutor=test_user, content=exam) for exam in Exam.objects.all()]
        assignments = [Allocation(tutor=test_user, content=assignment) for assignment in Assignment.objects.all()]
        discussions = [Allocation(tutor=test_user, content=discussion) for discussion in Discussion.objects.all()]
        Allocation.objects.bulk_create(exams + assignments + discussions, ignore_conflicts=True)

    @staticmethod
    def create_public_catalog(name: str, media_size: int):
        public_catalog = CatalogFactory.create(
            name=name,
            description=_(
                "Public catalogs are available to everyone. "
                "Generally, public catalogs are composef of video or PDF content."
            ),
            active=True,
            public=True,
            post_generation=False,
        )

        catalog_items = []
        for i, media in enumerate(MediaFactory.create_batch(size=media_size, format=Media.MediaFormatChoices.VIDEO)):
            if i == 0 and media.thumbnail:
                public_catalog.thumbnail = ContentFile(media.thumbnail.read())
                public_catalog.thumbnail.name = media.thumbnail.name
                public_catalog.save()

            catalog_items.append(
                CatalogItem(
                    catalog=public_catalog,
                    content_type=ContentType.objects.get_for_model(Media),
                    content_id=media.pk,
                    ordering=i,
                )
            )

        CatalogItem.objects.bulk_create(catalog_items, ignore_conflicts=True)
