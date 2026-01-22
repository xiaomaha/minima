import os
import tempfile

import pytest
from django.contrib.contenttypes.models import ContentType
from openpyxl import Workbook
from tablib import Dataset

from apps.account.tests.factories import UserFactory
from apps.operation.import_export import CategoryResource
from apps.operation.models import Category
from apps.operation.tests.factories import (
    AnnouncementFactory,
    AttachmentFactory,
    FAQFactory,
    HonorCodeFactory,
    InquiryFactory,
    InstructorFactory,
    MessageFactory,
    PolicyFactory,
    ThreadFactory,
)
from conftest import AdminUser


@pytest.mark.django_db
def test_announcement():
    AnnouncementFactory.create()


@pytest.mark.django_db
def test_instructor():
    InstructorFactory.create()


@pytest.mark.django_db
def test_honor_code():
    HonorCodeFactory.create()


@pytest.mark.django_db
def test_faq():
    FAQFactory.create()


@pytest.mark.django_db
def test_attachment(admin_user: AdminUser):
    AttachmentFactory.create(owner=admin_user.get_user())


@pytest.mark.django_db
def test_inquiry():
    InquiryFactory.create(content=UserFactory.create())


@pytest.mark.django_db
def test_category_resource_import_data():
    Category.objects.all().delete()

    test_data = [["name", "ancestors"], ["root1", ""], ["root2", ""], ["sub1", "root1"], ["leaf1", "root1,sub1"]]

    wb = Workbook()
    ws = wb.active or wb.create_sheet()

    for row_data in test_data:
        ws.append(row_data)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp_file:
        wb.save(tmp_file.name)
        tmp_filename = tmp_file.name

    try:
        with open(tmp_filename, "rb") as f:
            dataset = Dataset().load(f.read(), format="xlsx", headers=True)

        resource = CategoryResource()
        resource.import_data(dataset, dry_run=False)

        assert Category.objects.count() == 4

        root1 = Category.objects.filter(name="root1", ancestors=[]).first()
        assert root1 is not None
        assert root1.depth == 1

        sub1 = Category.objects.filter(name="sub1", ancestors=["root1"]).first()
        assert sub1 is not None
        assert sub1.depth == 2

        leaf1 = Category.objects.filter(name="leaf1", ancestors=["root1", "sub1"]).first()
        assert leaf1 is not None
        assert leaf1.depth == 3

    finally:
        os.unlink(tmp_filename)


@pytest.mark.django_db
def test_message():
    MessageFactory.create_batch(10)


@pytest.mark.django_db
def test_policy():
    PolicyFactory.create()


@pytest.mark.django_db
def test_thread():
    subject = UserFactory.create()
    ThreadFactory.create(subject_type=ContentType.objects.get_for_model(subject), subject_id=subject.pk)
