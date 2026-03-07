import logging

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.operation.models import FAQ, HonorCode, Policy

log = logging.getLogger(__name__)


class Command(BaseCommand):
    def handle(self, *args: object, **options: dict[str, object]):

        # policies
        for i, (value, label) in enumerate(Policy.KindChoices.choices):
            policy, created = Policy.objects.get_or_create(
                kind=value,
                defaults={
                    "title": str(label),
                    "description": str(label),
                    "active": True,
                    "mandatory": value != Policy.KindChoices.MARKETING_POLICY.value,
                    "priority": i,
                },
            )

            if created:
                policy.policy_versions.create(
                    body=f"Write default {label} policy here",
                    data_category={},
                    version="1.0",
                    effective_date=timezone.now(),
                )
                self.stdout.write(self.style.SUCCESS(f"Successfully created policy: {policy.title}"))
            else:
                self.stdout.write(self.style.WARNING(f"Policy already exists: {policy.title}"))

        # honor code
        HonorCode.objects.get_or_create(
            title=_("Student Honor Code"), defaults={"code": "Write default student honor code here"}
        )

        # faq
        faq, created = FAQ.objects.get_or_create(
            name=_("Frequently Asked Questions"), defaults={"description": _("default faq")}
        )

        if created:
            for i in range(1, 5):
                faq.items.create(
                    question=_("Write FAQ question %d here") % i, answer=_("Write FAQ answer %d here") % i, ordering=i
                )
