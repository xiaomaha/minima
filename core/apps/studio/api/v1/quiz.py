from typing import Annotated

from asgiref.sync import sync_to_async
from django.conf import settings
from django.db import IntegrityError
from django.db.models import Prefetch
from django.shortcuts import aget_object_or_404
from ninja import Field, Router, UploadedFile
from ninja.params import functions
from pydantic import RootModel

from apps.common.error import ErrorCode
from apps.common.schema import FileSizeValidator, FileTypeValidator, LearningObjectMixinSchema, Schema
from apps.common.util import HttpRequest, ModeChoices
from apps.quiz.models import Attempt, Question, QuestionPool, Quiz, Solution
from apps.studio.decorator import editor_required, track_editing


class QuizQuestionSaveSpec(Schema):
    class QuizQuestionSolutionSpec(Schema):
        correct_answers: list[str]
        explanation: str

    id: Annotated[int, Field(None)]
    question: str
    supplement: str
    options: list[str]
    point: int
    solution: QuizQuestionSolutionSpec


class QuizQuestionSpec(QuizQuestionSaveSpec):
    id: int

    @staticmethod
    def resolve_supplement(obj: Question):
        return obj.cleaned_supplement


# RootModel not working with multipart
class QuizQuestionsSaveSpec(Schema):
    data: list[QuizQuestionSaveSpec]


class QuizQuestionsSpec(RootModel[list[QuizQuestionSpec]]):
    pass


class QuizSpec(LearningObjectMixinSchema):
    class QuizQuestionPoolSpec(Schema):
        select_count: int

    id: str

    question_pool: QuizQuestionPoolSpec
    questions: QuizQuestionsSpec

    @staticmethod
    def resolve_questions(obj: Quiz):
        return obj.question_pool.questions.all()


class QuizSaveSpec(Schema):
    id: Annotated[str, Field(None)]
    title: str
    description: str
    audience: str
    featured: bool
    passing_point: int
    max_attempts: int
    question_pool: QuizSpec.QuizQuestionPoolSpec


router = Router(by_alias=True)


@router.get("/quiz/{id}", response=QuizSpec)
@editor_required()
async def get_quiz(request: HttpRequest, id: str):
    return (
        await Quiz.objects
        .select_related("question_pool")
        .prefetch_related(
            Prefetch(
                "question_pool__questions",
                queryset=Question.objects.prefetch_related("attachments").select_related("solution").order_by("id"),
            )
        )
        .aget(id=id, owner_id=request.auth)
    )


@router.post("/quiz", response=str)
@editor_required()
@track_editing(Quiz)
async def save_quiz(
    request: HttpRequest,
    data: QuizSaveSpec,
    thumbnail: Annotated[
        Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    quiz_dict = data.model_dump(exclude_unset=True)
    quiz_id = quiz_dict.pop("id", None)
    question_pool = quiz_dict.pop("question_pool")

    if thumbnail:
        quiz_dict["thumbnail"] = thumbnail

    if quiz_id:
        quiz = await aget_object_or_404(Quiz, id=quiz_id, owner_id=request.auth)
        for key, value in quiz_dict.items():
            setattr(quiz, key, value)
        await quiz.asave()
        await QuestionPool.objects.filter(id=quiz.question_pool_id).aupdate(**question_pool)

    else:

        @sync_to_async
        def create_new():
            try:
                pool = QuestionPool.objects.create(**question_pool, owner_id=request.auth, title=data.title)
                quiz = Quiz.objects.create(**quiz_dict, question_pool=pool, owner_id=request.auth)
            except IntegrityError:
                raise ValueError(ErrorCode.TITLE_ALREADY_EXISTS)
            return quiz

        quiz = await create_new()

    return quiz.id


@router.delete("/quiz/{id}")
@editor_required()
@track_editing(Quiz, id_field="id")
async def delete_quiz(request: HttpRequest, id: str):
    if await Attempt.objects.filter(quiz_id=id, mode=ModeChoices.NORMAL).aexists():
        raise ValueError(ErrorCode.ATTEMPT_EXISTS)
    await Quiz.objects.filter(id=id, owner_id=request.auth, published__isnull=True).adelete()


@router.get("/quiz/{id}/question", response=list[QuizQuestionSpec])
@editor_required()
async def get_quiz_questions(request: HttpRequest, id: str):
    return [
        q
        async for q in Question.objects
        .select_related("solution")
        .prefetch_related("attachments")
        .filter(pool__quiz__id=id, pool__quiz__owner_id=request.auth)
    ]


@router.post("/quiz/{id}/question", response=list[int])
@editor_required()
@track_editing(Quiz, id_field="id")
async def save_quiz_questions(
    request: HttpRequest,
    id: str,
    data: QuizQuestionsSaveSpec,
    files: Annotated[
        list[Annotated[UploadedFile, FileSizeValidator(), FileTypeValidator()]],
        functions.File(None, description=f"Max size: {settings.ATTACHMENT_MAX_SIZE_MB}MB"),
    ],
):
    quiz = await aget_object_or_404(Quiz, id=id, owner_id=request.auth)
    questions, solutions, is_new = [], [], []

    dumped = data.model_dump()["data"]
    for question_data in dumped:
        is_new.append(not question_data["id"])

        if not question_data["id"]:
            question_data["id"] = None

        solution_data = question_data.pop("solution")
        solution_data["correct_answers"] = [x for x in solution_data["correct_answers"] if x.strip()]

        question = Question(pool_id=quiz.question_pool_id, **question_data)
        questions.append(question)
        solutions.append(Solution(question=question, **solution_data))

    await Question.objects.abulk_create(
        questions,
        update_conflicts=True,
        unique_fields=["id"],
        update_fields=["question", "supplement", "options", "point"],
    )

    await Solution.objects.abulk_create(
        solutions,
        update_conflicts=True,
        unique_fields=["question_id"],
        update_fields=["correct_answers", "explanation"],
    )

    for question, new in zip(questions, is_new):
        if new:
            question._prefetched_objects_cache = {"attachments": []}
        await question.update_attachments(files=files, owner_id=request.auth, content=question.supplement)

    return [q.id for q in questions]


@router.delete("/quiz/{id}/question/{question_id}")
@editor_required()
@track_editing(Quiz, id_field="id")
async def delete_quiz_quesion(request: HttpRequest, id: str, question_id: int):
    if await Attempt.objects.filter(
        quiz_id=id, questions=question_id, quiz__owner_id=request.auth, mode=ModeChoices.NORMAL
    ).aexists():
        raise ValueError(ErrorCode.IN_USE)

    count, _ = await Question.objects.filter(id=question_id, pool__quiz__id=id).adelete()
    if count < 1:
        raise ValueError(ErrorCode.NOT_FOUND)
