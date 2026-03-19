from django.contrib import admin

from apps.common.admin import ModelAdmin, ReadOnlyHiddenModelAdmin, ReadOnlyTabularInline
from apps.learning.models import Catalog, CatalogItem, CohortCatalog, Enrollment, LearningTerm, UserCatalog


@admin.register(Enrollment)
class EnrollmentAdmin(ModelAdmin[Enrollment]):
    class EnrollmentEventInline(ReadOnlyTabularInline[Enrollment.pgh_event_model]):
        model = Enrollment.pgh_event_model

    inlines = (EnrollmentEventInline,)


@admin.register(LearningTerm)
class LearningTermAdmin(ModelAdmin[LearningTerm]):
    pass


@admin.register(Enrollment.pgh_event_model)
class EnrollmentEventAdmin(ReadOnlyHiddenModelAdmin[Enrollment.pgh_event_model]):
    pass


@admin.register(Catalog)
class CatalogAdmin(ModelAdmin[Catalog]):
    class CatalogItemInline(ReadOnlyTabularInline[CatalogItem]):
        model = CatalogItem

    inlines = (CatalogItemInline,)


@admin.register(CatalogItem)
class CatalogItemAdmin(ReadOnlyHiddenModelAdmin[CatalogItem]):
    pass


@admin.register(UserCatalog)
class UserCatalogAdmin(ModelAdmin[UserCatalog]):
    pass


@admin.register(CohortCatalog)
class CohortCatalogAdmin(ModelAdmin[CohortCatalog]):
    pass
