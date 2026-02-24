import os

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.account.models import User


class Command(BaseCommand):
    help = "Create default roles (groups)"

    def handle(self, *args, **options):
        roles = ["editor", "grader", "partner_staff"]

        groups = [Group(name=role_name) for role_name in roles]
        Group.objects.bulk_create(groups, ignore_conflicts=True)

        super_user = User.objects.get(email=os.environ.get("DJANGO_SUPERUSER_EMAIL") or "admin@example.com")
        super_user.groups.set(Group.objects.all())
