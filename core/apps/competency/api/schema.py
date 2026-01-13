from datetime import datetime
from typing import Annotated

from ninja import Field, FilterLookup, FilterSchema

from apps.common.schema import Schema, TimeStampedMixinSchema
from apps.partner.api.schema import PartnerSchema


class ClassificationSchema(Schema):
    id: int
    name: str
    ancestors: list[str]


class CompetencySkillSchema(Schema):
    name: str
    level: int
    classification: ClassificationSchema


class CompetencyFactorySchema(Schema):
    name: str
    number: str


class CertificateSchema(Schema):
    id: int
    name: str
    description: str
    thumbnail: str
    issuer: PartnerSchema
    certificateskill_set: list[CertificateSkillSchema]
    certificateendorsement_set: list[CertificateEndorsementSchema]


class CertificateSkillSchema(Schema):
    skill: CompetencySkillSchema
    factors: list[CompetencyFactorySchema]
    coverage: float


class CertificateEndorsementSchema(Schema):
    partner: PartnerSchema
    claim: str
    endorsed: datetime


class CertificateAwardSchema(Schema):
    id: int
    created: datetime
    pdf: str
    thumbnail: str
    certificate_id: int


class CertificateFilterSchema(FilterSchema, Schema):
    course_id: Annotated[str, FilterLookup(q="course__id")]


class ClassificationTreeNodeSchema(Schema):
    id: int
    name: str
    children: list["ClassificationTreeNodeSchema"]


class SkillDataSchema(Schema):
    id: int
    name: str
    level: int
    factor_set: list[FactoryDataSchema]


class FactoryDataSchema(Schema):
    id: int
    name: str


class CompetencyGoalSchema(TimeStampedMixinSchema):
    id: int
    name: str
    description: str
    classification: ClassificationSchema
    factor_ids: list[int]


class CompetencyGoalSaveSchema(Schema):
    name: Annotated[str, Field(min_length=5)]
    description: str
    classification_id: int
    factor_ids: Annotated[list[int], Field(min_items=1)]
