import logging

import firebase_admin
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

_firebase_initialized = False


def initialize_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return

    if not settings.FIREBASE_CREDENTIALS:
        try:
            raise ImproperlyConfigured("FIREBASE_CREDENTIALS not set")
        except ImproperlyConfigured as e:
            logger.error(e)
            return

    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True


def send_fcm(*, tokens: list[str], title: str, body: str, data: dict | None = None):
    from apps.operation.models import NotificationDevice

    initialize_firebase()

    if not _firebase_initialized:
        return

    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                headers={"apns-priority": "10"}, payload=messaging.APNSPayload(aps=messaging.Aps(sound="default"))
            ),
        )
        for token in tokens
    ]

    response = messaging.send_each(messages)

    if response.failure_count > 0:
        failed_tokens = [tokens[idx] for idx, resp in enumerate(response.responses) if not resp.success]

        NotificationDevice.objects.filter(token__in=failed_tokens).update(active=False)

    return response
