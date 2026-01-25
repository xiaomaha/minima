from django.contrib import admin
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from unfold.contrib.filters.admin.dropdown_filters import RelatedDropdownFilter
from unfold.contrib.filters.admin.text_filters import FieldTextFilter

from apps.common.admin import (
    HiddenModelAdmin,
    ImportExportModelAdmin,
    ModelAdmin,
    ReadOnlyHiddenModelAdmin,
    ReadOnlyTabularInline,
    TabularInline,
)
from apps.partner.import_export import MemberResource
from apps.partner.models import Cohort, CohortMember, CohortStaff, Group, Member, Partner


@admin.register(Partner)
class PartnerAdmin(ModelAdmin[Partner]):
    class GroupInline(TabularInline[Group]):
        model = Group

        @admin.display(description="ID")
        def id_(self, obj: Partner):
            return obj.pk

        def get_readonly_fields(self, request: HttpRequest, obj: Group | None = None):
            readonly_fields = list(super().get_readonly_fields(request, obj))
            return ["id_"] + readonly_fields

    inlines = (GroupInline,)


@admin.register(Group)
class GroupAdmin(HiddenModelAdmin[Group]):
    pass


@admin.register(Member)
class MemberAdmin(ImportExportModelAdmin[Member]):
    class CohortMemberInline(TabularInline[CohortMember]):
        model = CohortMember

    class MemberEventInline(ReadOnlyTabularInline[Member.pgh_event_model]):
        model = Member.pgh_event_model

    inlines = (CohortMemberInline, MemberEventInline)

    resource_class = MemberResource

    list_filter_submit = True
    list_filter = [
        ("group__partner", RelatedDropdownFilter),
        ("group", RelatedDropdownFilter),
        ("team", FieldTextFilter),
        ("cohortmember__cohort", RelatedDropdownFilter),
    ]

    @admin.display(description=_("User"), boolean=True)
    def linked_user(self, obj: Member):
        return bool(obj.user)

    def get_export_queryset(self, request):
        # limit to 1000
        return super().get_export_queryset(request)[:1000]

    def get_list_display(self, request: HttpRequest):
        list_display = super().get_list_display(request)
        return tuple(
            f for f in list_display if f not in ["encrypted_id_number", "employment_status", "employment_type"]
        ) + ("linked_user",)


@admin.register(Cohort)
class CohortAdmin(ModelAdmin[Cohort]):
    class StaffInline(TabularInline[CohortStaff]):
        model = CohortStaff

    class MemberInline(TabularInline[CohortMember]):
        model = CohortMember
        exclude = ("encrypted_id_number", "employment_status", "employment_type")

    exclude = ("members",)
    inlines = (StaffInline, MemberInline)


@admin.register(CohortStaff)
class CohortStaffAdmin(HiddenModelAdmin[CohortStaff]):
    pass


@admin.register(CohortMember)
class CohortMemberAdmin(HiddenModelAdmin[CohortMember]):
    pass


@admin.register(Member.pgh_event_model)
class CohortMemberEventAdmin(ReadOnlyHiddenModelAdmin[Member.pgh_event_model]):
    pass
