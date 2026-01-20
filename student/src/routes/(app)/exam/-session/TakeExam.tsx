import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, getValue, toCustom, validate, valiForm } from '@modular-forms/solid'
import { debounce } from '@solid-primitives/scheduled'
import { For, type JSX, onMount, Show } from 'solid-js'
import type * as v from 'valibot'
import { examV1SaveAnswers, examV1SubmitAttempt, type LearningSessionStep } from '@/api'
import { vExamAttemptAnswersSchema } from '@/api/valibot.gen'
import { SAVE_ATTEMPT_INTERVAL_SECONDS } from '@/config'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { useSession } from './context'

const SITTING = 1 as LearningSessionStep
const GRADING = 3 as LearningSessionStep

export const TakeExam = () => {
  const [t] = useTransContext()

  const [session, { setStore }] = useSession()
  const s = () => session.data!

  const questions = s().attempt!.questions
  const questionRefs: Record<string, HTMLElement> = {}
  const savedAnswers = { ...(s().attempt?.savedAnswers || {}) }

  const [submitForm, { Form, Field }] = createForm<v.InferInput<typeof vExamAttemptAnswersSchema>>({
    initialValues: {
      ...s().attempt!.questions.reduce(
        (acc, question) => {
          acc[String(question.id)] = (s().submission?.answers || s().attempt?.savedAnswers)?.[String(question.id)] ?? ''
          return acc
        },
        {} as Record<string, string>,
      ),
    },
    validate: valiForm(vExamAttemptAnswersSchema),
    validateOn: 'input',
    revalidateOn: 'input',
  })

  const submitAnswers = async (values: v.InferInput<typeof vExamAttemptAnswersSchema>) => {
    if (!confirm(t('Are you sure you want to submit your answers? This action cannot be undone.'))) return

    const { data } = await examV1SubmitAttempt({ path: { id: s().exam.id }, body: values })
    setStore('data', 'submission', data)
    setStore('data', 'step', GRADING)
    scrollTo(0, 0)
  }

  const saveAnswers = debounce(async () => {
    const changedAnswers: Record<string, string> = {}
    questions.forEach((q) => {
      const qId = String(q.id)
      const currentValue = getValue(submitForm, qId) ?? ''
      if (currentValue !== (savedAnswers[qId] ?? '') && currentValue.trim() !== '') {
        changedAnswers[qId] = currentValue
      }
    })
    if (Object.keys(changedAnswers).length > 0) {
      await examV1SaveAnswers({ path: { id: s().exam.id }, body: changedAnswers })
      Object.assign(savedAnswers, changedAnswers)
    }
  }, SAVE_ATTEMPT_INTERVAL_SECONDS * 1000)

  onMount(() => queueMicrotask(() => validate(submitForm)))

  const disabled = () => s().step !== SITTING

  return (
    <div class="card w-full p-4 md:p-8 bg-base-100 shadow-sm">
      <Form onSubmit={submitAnswers} onChange={saveAnswers}>
        <fieldset class="space-y-16" disabled={disabled()}>
          <For each={questions}>
            {(question, i) => {
              const field = (
                <Field
                  name={String(question.id)}
                  transform={toCustom((value) => (typeof value === 'string' ? value.trim() : value), { on: 'blur' })}
                >
                  {(field, props) => {
                    let input: JSX.Element

                    if (question.format === 'single_choice') {
                      input = (
                        <div class="space-y-2 validator">
                          <For each={question.options}>
                            {(option, j) => (
                              <label class="label text-base-content cursor-pointer text-lg flex gap-4 max-w-full py-1">
                                <input
                                  {...props}
                                  checked={field.value === String(j() + 1)}
                                  type="radio"
                                  class="radio radio-md"
                                  value={j() + 1}
                                  required
                                />
                                <span class="text-base-content/70">{option}</span>
                              </label>
                            )}
                          </For>
                        </div>
                      )
                    } else if (question.format === 'text_input') {
                      input = (
                        <input
                          {...props}
                          value={field.value ?? ''}
                          type="text"
                          class="input w-full validator input-lg"
                          placeholder={t('Input your answer')}
                          required
                        />
                      )
                    } else if (question.format === 'essay') {
                      input = (
                        <textarea
                          {...props}
                          value={field.value ?? ''}
                          class="textarea w-full validator input-lg field-sizing-content min-h-32"
                          placeholder={t('Write your answer here')}
                          required
                        />
                      )
                    } else if (question.format === 'number_input') {
                      input = (
                        <input
                          {...props}
                          value={field.value ?? ''}
                          type="number"
                          class="input w-full validator input-lg"
                          placeholder={t('Input your answer by number')}
                          required
                        />
                      )
                    }

                    return input
                  }}
                </Field>
              )

              return (
                <div
                  ref={(el) => {
                    questionRefs[String(question.id)] = el
                  }}
                  class="space-y-8 relative"
                >
                  <div class="mb-4 text-sm flex justify-between">
                    <span class="label">{t('Question {{num}}', { num: i() + 1 })}</span>
                    <div class="badge badge-sm badge-outline">{t('{{count}} point', { count: question.point })}</div>
                  </div>
                  <legend class="card-title">{question.question}</legend>

                  <Show when={question.supplement}>
                    <ContentViewer content={question.supplement!} class="bg-base-content/5 rounded-box p-8 w-full" />
                  </Show>

                  <div class="relative">
                    {field}
                    <div class="validator-hint absolute -bottom-6">{t('Required *')}</div>
                  </div>
                </div>
              )
            }}
          </For>

          <div class="sticky bottom-8 w-full min-h-6">
            <Show when={submitForm.invalid || disabled()}>
              <div class="absolute flex h-full w-full cursor-pointer">
                <For each={Object.entries(questionRefs)}>
                  {([qID, ref], i) => (
                    <div
                      class="flex-1 h-full w-full bg-base-content/10 tooltip"
                      classList={{
                        'rounded-l-md': i() === 0,
                        'rounded-r-md': i() === Object.keys(questionRefs).length - 1,
                        'bg-primary/40': !!getValue(submitForm, qID),
                      }}
                      data-tip={t('Question {{num}}', { num: i() + 1 })}
                      onclick={() => ref.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Show when={!disabled()}>
              <SubmitButton
                label={t('Submit Answers')}
                isPending={submitForm.submitting}
                disabled={submitForm.invalid} // cf. submitForm.dirty
                class="btn btn-primary w-full"
              />
            </Show>
          </div>
        </fieldset>
      </Form>
    </div>
  )
}
