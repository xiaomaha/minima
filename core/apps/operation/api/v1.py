from typing import Annotated

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import aget_object_or_404
from ninja.files import UploadedFile
from ninja.pagination import paginate
from ninja.params import Form, Query, functions
from ninja.router import Router

from apps.common.schema import FileSizeValidator, FileTypeValidator
from apps.common.util import HttpRequest, Pagination
from apps.operation.api.schema import (
    AnnouncementSchema,
    AppealCreateSchema,
    AppealSchema,
    CommentBriefSchema,
    CommentNestedSchema,
    CommentSavedSchema,
    CommentSaveSchema,
    DeviceRegisterSchema,
    DeviceSchema,
    InquiryCreateSchema,
    InquiryFilterSchema,
    InquirySavedSchema,
    InquirySchema,
    InquiryUpdateSchema,
    MessageSchema,
    PolicyVersionAgreementSchema,
    SitePolicySchema,
    ThreadCreateSchema,
    ThreadSchema,
)
from apps.operation.models import (
    Announcement,
    AnnouncementRead,
    Appeal,
    Comment,
    Inquiry,
    Message,
    MessageRead,
    NotificationDevice,
    Policy,
    PolicyAgreement,
    Thread,
)

router = Router(by_alias=True)


@router.get("/announcement", response=list[AnnouncementSchema])
@paginate(Pagination)
async def get_announcements(request: HttpRequest):
    return Announcement.get_announcements(user_id=request.auth)


@router.post("/announcement/{id}/read")
async def read_announcement(request: HttpRequest, id: int):
    await AnnouncementRead.objects.acreate(user_id=request.auth, announcement_id=id)


@router.get("/inquiry", response=list[InquirySchema])
@paginate(Pagination)
async def get_inquiries(request: HttpRequest, filter: Query[InquiryFilterSchema]):
    qs = (
        Inquiry.objects
        .select_related("content_type")
        .prefetch_related("inquiry_responses__writer", "attachments")
        .filter(writer_id=request.auth)
        .order_by("-created")
    )
    return filter.filter(qs)


@router.post("/inquiry", response=InquirySavedSchema)
async def create_inquiry(
    request: HttpRequest,
    data: Form[InquiryCreateSchema],
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    return await Inquiry.create(**data.model_dump(), writer_id=request.auth, files=files)


@router.post("/inquiry/{id}", response=InquirySavedSchema)
async def update_inquiry(
    request: HttpRequest,
    id: int,
    data: Form[InquiryUpdateSchema],
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    return await Inquiry.update(**data.model_dump(), writer_id=request.auth, id=id, files=files)


@router.get("/message", response=list[MessageSchema])
@paginate(Pagination)
async def get_unread_messages(request: HttpRequest):
    return Message.get_unread_messages(user_id=request.auth)


@router.post("/message/{id}/read")
async def read_message(request: HttpRequest, id: int):
    await aget_object_or_404(Message, id=id, user_id=request.auth)
    await MessageRead.objects.aget_or_create(message_id=id)


@router.post("/appeal", response=AppealSchema)
async def create_appeal(
    request: HttpRequest,
    data: Form[AppealCreateSchema],
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    return await Appeal.create(**data.model_dump(), learner_id=request.auth, files=files)


@router.get("/policy/effective", auth=None, response=list[SitePolicySchema])
async def effective_policies(
    request: HttpRequest, user_id: Annotated[str | None, functions.Query(None, alias="userId")]
):
    return await Policy.effective_policies(user_id=user_id)


@router.post("/policy/agree")
async def agree_policies(request: HttpRequest, data: PolicyVersionAgreementSchema):
    return await PolicyAgreement.agree_policies(user_id=request.auth, agreements=data.model_dump())


@router.get("/thread/{app_label}/{model}/subject/{subject_id}", response=ThreadSchema)
async def get_thread(request: HttpRequest, app_label: str, model: str, subject_id: str):
    return await aget_object_or_404(
        Thread, subject_id=subject_id, subject_type__app_label=app_label, subject_type__model=model
    )


@router.post("/thread", response=ThreadSchema)
async def create_thread(request: HttpRequest, data: ThreadCreateSchema):
    d = data.model_dump(exclude_unset=True)
    subject_type = await aget_object_or_404(ContentType, app_label=d.pop("app_label"), model=d.pop("model"))
    thread, _ = await Thread.objects.aget_or_create(
        subject_type=subject_type, subject_id=d.pop("subject_id"), defaults=d
    )
    return thread


@router.get("/thread/{id}/comment", response=list[CommentNestedSchema])
@paginate(Pagination)
async def get_thread_comments(request: HttpRequest, id: int):
    return (
        Comment.objects
        .select_related("writer")
        .prefetch_related("children__writer", "children__attachments", "attachments")
        .filter(parent_id=None, thread_id=id)
        .order_by("-pinned", "-created")
    )


@router.post("/thread/{id}/comment", response=CommentSavedSchema)
async def save_comment(
    request: HttpRequest,
    id: int,
    data: Form[CommentSaveSchema],
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    return await Comment.upsert(
        **data.model_dump(exclude_unset=True), thread_id=id, writer_id=request.auth, files=files
    )


@router.delete("/thread/{id}/comment/{comment_id}")
async def delete_comment(request: HttpRequest, id: int, comment_id: int):
    comment = await aget_object_or_404(Comment, id=comment_id, thread_id=id, writer_id=request.auth)
    comment.deleted = True
    await comment.asave()


@router.get("/comment", response=list[CommentBriefSchema])
@paginate(Pagination)
async def get_comments(request: HttpRequest):
    return (
        Comment.objects
        .select_related("writer", "thread__subject_type")
        .filter(writer_id=request.auth)
        .order_by("-pinned", "-created")
    )


@router.get("/device", response=list[DeviceSchema])
async def get_devices(request: HttpRequest):
    return [d async for d in NotificationDevice.objects.filter(user_id=request.auth).order_by("id")]


@router.post("/device", response=DeviceSchema)
async def register_device(request: HttpRequest, data: DeviceRegisterSchema):
    device, _ = await NotificationDevice.objects.aupdate_or_create(
        token=data.token, defaults={"user_id": request.auth, "platform": data.platform, "device_name": data.device_name}
    )
    return device


@router.delete("/device/{id}")
async def delete_device(request: HttpRequest, id: int):
    await NotificationDevice.objects.filter(id=id).adelete()


@router.post("/device/{id}/active")
async def toggle_device_active(request: HttpRequest, id: int):
    await NotificationDevice.toggle_active(id=id)
