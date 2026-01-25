import pytest

from apps.store.tests.factories import CartFactory, CouponFactory, ProductFactory


@pytest.mark.order(-1)
@pytest.mark.django_db
def test_store():
    ProductFactory.create_batch(3)
    CouponFactory.create_batch(3)
    CartFactory.create_batch(3)
