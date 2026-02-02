from datetime import datetime

from import_export.fields import Field
from import_export.resources import ModelResource
from import_export.widgets import CharWidget

from apps.partner.models import Member


class MemberResource(ModelResource):
    personal_id = Field(
        attribute="encrypted_personal_id", column_name="personal_id", widget=CharWidget(allow_blank=True)
    )

    class Meta:
        model = Member
        skip_unchanged = True
        export_order = ("id", "cohort", "name", "email", "birth_date", "personal_id")
        import_order = export_order
        exclude = ("created", "modified", "encrypted_personal_id", "user")

    def before_import_row(self, row, **kwargs):
        for k, v in row.items():
            if isinstance(v, datetime) and k == "birth_date":
                row[k] = v.date()
            elif isinstance(v, str):
                row[k] = v.strip()

        if "personal_id" in row and row["personal_id"]:
            row["personal_id"] = Member.encrypt_personal_id(row["personal_id"])
        elif "personal_id" in row:
            del row["personal_id"]

        super().before_import_row(row, **kwargs)

    def dehydrate_personal_id(self, obj):
        return ""
