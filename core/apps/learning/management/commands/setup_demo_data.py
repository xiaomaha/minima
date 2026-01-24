import os
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.account.models import User
from apps.content.models import Media, PublicAccessMedia
from apps.content.tests.factories import MediaFactory
from apps.learning.models import CatalogItem
from apps.learning.tests.factories import CatalogFactory, CohortCatalogFactory, UserCatalogFactory
from apps.operation.tests.factories import AnnouncementFactory, InquiryFactory
from apps.partner.models import BusinessSite
from apps.partner.tests.factories import CohortFactory, EmployeeFactory, PartnerFactory


class Command(BaseCommand):
    help = "Setup demo datalog"

    def handle(self, *args, **options):
        # test user
        test_user = User.objects.get(email=os.environ.get("DJANGO_SUPERUSER_EMAIL") or "admin@example.com")

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

        # partner, site, employee, cohort
        partner = PartnerFactory.create()
        site = BusinessSite.objects.filter(partner=partner).first()
        if not site:
            raise ImproperlyConfigured("No business site found for partner")

        employee = EmployeeFactory.create(site=site, email=test_user.email, user=test_user)
        cohort = CohortFactory.create()
        cohort.employees.add(employee)

        CohortCatalogFactory.create(cohort=cohort, catalog=cohort_catalog)

        # public catalog again
        self.create_public_catalog(f"{_('Demo Public Catalog')} 2", 24)

        # all the rest video content

        from apps.content.tests.factories import _REAL_DATA

        remains = len(_REAL_DATA) - Media.objects.filter(format=Media.FormatChoices.VIDEO).count()
        if remains > 0:
            new_medias = MediaFactory.create_batch(
                size=remains, format=Media.FormatChoices.VIDEO, post_generation=False
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

        # announcement
        AnnouncementFactory.create_batch(size=50)

        # inquery
        InquiryFactory.create_batch(size=50, writer=test_user, content=test_user)

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
        for i, media in enumerate(MediaFactory.create_batch(size=media_size, format=Media.FormatChoices.VIDEO)):
            if i == 0:
                public_catalog.thumbnail = media.thumbnail
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
