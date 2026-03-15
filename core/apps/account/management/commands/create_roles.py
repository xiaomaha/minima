import os

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.account.models import User
from apps.common.policy import PlatformRealm


class Command(BaseCommand):
    help = "Create default roles (groups)"

    def handle(self, *args, **options):
        groups = [Group(name=role_name) for role_name in PlatformRealm]
        Group.objects.bulk_create(groups, ignore_conflicts=True)

        super_user = User.objects.get(email=os.environ.get("DJANGO_SUPERUSER_EMAIL") or "admin@example.com")
        super_user.groups.set(Group.objects.all())
