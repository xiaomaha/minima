import secrets
from datetime import timedelta

from django.utils import timezone
from factory.declarations import LazyAttribute, LazyFunction, SubFactory
from factory.django import DjangoModelFactory

from apps.account.tests.factories import UserFactory
from apps.sso.models import SSOAccount, SSOSession


class SSOAccountFactory(DjangoModelFactory[SSOAccount]):
    user = SubFactory(UserFactory)
    provider = "google"
    provider_user_id = LazyAttribute(lambda o: f"google-{o.user.id}")
    email = LazyAttribute(lambda o: o.user.email)

    class Meta:
        model = SSOAccount
        django_get_or_create = ("provider", "provider_user_id")


class SSOSessionFactory(DjangoModelFactory[SSOSession]):
    state = LazyFunction(lambda: secrets.token_urlsafe(32))
    nonce = LazyFunction(lambda: secrets.token_urlsafe(32))
    provider = "google"
    redirect_to = "http://localhost:8000"
    expires = LazyFunction(lambda: timezone.now() + timedelta(seconds=600))

    class Meta:
        model = SSOSession
