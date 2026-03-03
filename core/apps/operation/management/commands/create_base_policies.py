import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.operation.models import Policy

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Create empty policies"

    def handle(self, *args: object, **options: dict[str, object]):
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
                    body=f"Write your {label} policy here",
                    data_category={},
                    version="1.0",
                    effective_date=timezone.now(),
                )
                self.stdout.write(self.style.SUCCESS(f"Successfully created policy: {policy.title}"))
            else:
                self.stdout.write(self.style.WARNING(f"Policy already exists: {policy.title}"))
