import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-solidjs'
import { createEffect, For, onMount, Show } from 'solid-js'
import { reconcile, type SetStoreFunction } from 'solid-js/store'
import type * as v from 'valibot'
import {
  type LearningSessionStep,
  type QuizAttemptAnswersSchema,
  type QuizSessionSchema,
  quizV1DeactivateAttempt,
  quizV1SubmitAttempt,
} from '@/api'
import { vQuizAttemptAnswersSchema } from '@/api/valibot.gen'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { FinalScore } from '../grading/FinalScore'
import { setProgress } from '../record'

const SITTING = 1 as LearningSessionStep

interface Props {
  session: QuizSessionSchema
  setStore: SetStoreFunction<{ data: QuizSessionSchema | undefined }>
  inlineContext?: { media: string } //  inline quiz inside media
}

export const QuizForm = (props: Props) => {
  const { t } = useTranslation()
  const s = () => props.session

  const [formState, { Form, Field, getValue }] = createForm<v.InferInput<typeof vQuizAttemptAnswersSchema>>({
    initialValues: s().attempt!.questions.reduce(
      (acc, question) => {
        acc[String(question.id)] = s().submission?.answers[question.id] || ''
        return acc
      },
      {} as Record<string, string>,
    ),
    validate: valiForm(vQuizAttemptAnswersSchema),
    validateOn: 'input',
    revalidateOn: 'input',
  })

  const questionRefs: Record<string, HTMLElement> = {}
  let currentIdx = 0

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const refs = Object.values(questionRefs)
            currentIdx = refs.indexOf(entry.target as HTMLElement)
          }
        })
      },
      { threshold: 0.5 },
    )

    Object.values(questionRefs).forEach((el) => {
      observer.observe(el)
    })
  })

  const submit = async (answsers: QuizAttemptAnswersSchema) => {
    if (!s()) return
    const { data } = await quizV1SubmitAttempt({
      path: { id: s()!.quiz.id },
      body: answsers,
      query: props.inlineContext,
    })
    props.setStore('data', data)
    setProgress(s().quiz.id, data.grade!.score, '')
  }

  let gradeCarouselRef: HTMLDivElement | undefined
  createEffect(() => {
    if (s().grade && gradeCarouselRef && carouselRef) {
      carouselRef.scrollLeft = gradeCarouselRef.offsetLeft
    }
  })

  const resetSubmit = async () => {
    if (!s()) return
    await quizV1DeactivateAttempt({ path: { id: s()!.quiz.id }, query: props.inlineContext })
    props.setStore('data', reconcile({ accessDate: s().accessDate, step: 0, quiz: s()!.quiz }))
    setProgress(s().quiz.id, 0, '')
  }

  const disabled = () => s().step !== SITTING
  let carouselRef: HTMLDivElement | undefined

  const next = () => {
    if (!carouselRef) return
    const refs = Object.values(questionRefs)
    currentIdx = (currentIdx + 1) % refs.length
    const target = refs[currentIdx]
    if (target) {
      carouselRef.scrollLeft = target.offsetLeft
    }
  }

  const prev = () => {
    if (!carouselRef) return
    const refs = Object.values(questionRefs)
    currentIdx = (currentIdx - 1 + refs.length) % refs.length
    const target = refs[currentIdx]
    if (target) {
      carouselRef.scrollLeft = target.offsetLeft
    }
  }

  return (
    <Form onSubmit={submit}>
      <div class="fixed z-100 flex justify-between w-full px-4 pointer-events-none">
        <button type="button" class="btn btn-sm pointer-events-auto btn-ghost btn-circle" onClick={prev}>
          <IconChevronLeft size={16} />
        </button>
        <button type="button" class="btn btn-sm pointer-events-auto btn-ghost btn-circle" onClick={next}>
          <IconChevronRight size={16} />
        </button>
      </div>

      <div ref={carouselRef} class="carousel carousel-center rounded-box w-full h-full relative pb-4">
        <fieldset class="contents" disabled={disabled()}>
          <For each={s().attempt!.questions}>
            {(question, i) => (
              <div
                ref={(el) => {
                  questionRefs[String(question.id)] = el
                }}
                class="carousel-item w-full h-full overflow-auto"
              >
                <div class="px-8 flex flex-col gap-4 items-center w-full">
                  <div class="badge badge-neutral text-base!">{t('Question {{number}}', { number: i() + 1 })}</div>
                  <div class="my-4 font-semibold">{question.question}</div>
                  <Show when={question.supplement}>
                    <ContentViewer content={question.supplement!} class="bg-base-content/5 rounded-box p-4 w-full" />
                  </Show>

                  <Show when={s().solutions?.[String(question.id)]}>
                    {(solution) => (
                      <table class="table table-sm bg-base-300 [&_tr>td:first-child]:whitespace-nowrap">
                        <tbody>
                          <tr>
                            <td>{t('Correct Answer')}</td>
                            <td>{solution().correctAnswers.join(', ')}</td>
                          </tr>
                          <tr>
                            <td>{t('Explanation')}</td>
                            <td>{solution().explanation}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </Show>

                  <Field name={String(question.id)}>
                    {(field, props) => {
                      const questionId = String(question.id)
                      const selectionData = s().analysis?.[questionId] ?? {}
                      const totalSubmissions = Object.values(selectionData).reduce((sum, count) => sum + count, 0)

                      const selectionRates =
                        totalSubmissions > 0
                          ? Object.fromEntries(
                              Object.entries(selectionData).map(([option, count]) => [
                                option,
                                Math.round((count / totalSubmissions) * 100),
                              ]),
                            )
                          : {}

                      return (
                        <div class="space-y-1 validator w-full my-4 pb-12">
                          <For each={question.options}>
                            {(option, j) => (
                              <div class="flex items-center gap-8">
                                <label
                                  class="flex-1 py-2 label text-base text-base-content cursor-pointer flex gap-4 max-w-full"
                                  classList={{
                                    'bg-success/20 rounded': s().solutions?.[
                                      String(question.id)
                                    ]?.correctAnswers.includes(String(j() + 1)),
                                  }}
                                >
                                  <input
                                    {...props}
                                    type="radio"
                                    checked={field.value === String(j() + 1)}
                                    class="radio radio-md"
                                    value={j() + 1}
                                    required
                                  />
                                  <span class="text-base-content/70">{option}</span>
                                </label>

                                <Show when={totalSubmissions > 0}>
                                  <div class="flex flex-col items-end gap-1">
                                    <span class="text-xs label">{selectionRates[String(j() + 1)] ?? 0}%</span>
                                    <progress
                                      class="progress progress-accent w-24"
                                      value={selectionRates[String(j() + 1)] ?? 0}
                                      max="100"
                                    ></progress>
                                  </div>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      )
                    }}
                  </Field>
                </div>
              </div>
            )}
          </For>
        </fieldset>

        <Show when={s().grade}>
          <div
            ref={gradeCarouselRef}
            class="carousel-item w-full h-full flex flex-col gap-2 items-center overflow-auto"
          >
            <div class="px-8 pb-4 w-full space-y-4">
              <div class="text-xl font-semibold text-center">{s().quiz.title}</div>
              <FinalScore session={s()} passingPoint={s().quiz.passingPoint} compact />

              <div class="flex gap-2 justify-center items-center">
                <IconArrowLeft size={16} />
                <span class="label text-sm">{t('You can see explanations and stats.')}</span>

                <Show when={!s().quiz.maxAttempts || s().quiz.maxAttempts - 1 > s().attempt!.retry}>
                  <button
                    class="btn btn-xs btn-neutral tooltip tooltip-left"
                    data-tip={
                      !s().quiz.maxAttempts
                        ? undefined
                        : t('{{num}} remains', { num: s().quiz.maxAttempts - s().attempt!.retry - 1 })
                    }
                    type="button"
                    onClick={() => resetSubmit()}
                  >
                    {t('Retry')}
                    <IconRefresh size={16} />
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        <div class="flex gap-4 fixed justify-center bottom-4 w-full px-8">
          <Show when={!disabled()}>
            <div class="sticky bottom-4 w-full min-h-6">
              <Show when={formState.invalid}>
                <div class="absolute flex h-full w-full cursor-pointer">
                  <For each={Object.entries(questionRefs)}>
                    {([qID, ref], i) => (
                      <div
                        class="flex-1 h-full w-full bg-base-content/10 tooltip"
                        classList={{
                          'rounded-l-md': i() === 0,
                          'rounded-r-md': i() === Object.keys(questionRefs).length - 1,
                          'bg-primary/40': !!getValue(qID),
                        }}
                        data-tip={t('Question {{num}}', { num: i() + 1 })}
                        onclick={() => {
                          if (carouselRef) {
                            carouselRef.scrollLeft = ref.offsetLeft
                          }
                        }}
                      />
                    )}
                  </For>
                </div>
              </Show>

              <Show when={!formState.invalid}>
                <SubmitButton
                  label={t('Submit Answers')}
                  isPending={formState.submitting}
                  disabled={formState.invalid || !formState.dirty}
                  class="btn btn-primary w-full btn-sm"
                />
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Form>
  )
}
