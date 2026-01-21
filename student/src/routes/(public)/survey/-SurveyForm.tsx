import { createForm, getValue, toCustom, validate, valiForm } from '@modular-forms/solid'
import { For, type JSX, onMount, Show } from 'solid-js'
import type * as v from 'valibot'
import {
  learningV1GetRecords,
  type SurveySchema,
  surveyV1Results,
  surveyV1ResultsAnonymous,
  surveyV1Submit,
  surveyV1SubmitAnonymous,
} from '@/api'
import { vSurveyAnswersSchema } from '@/api/valibot.gen'
import { accessContext } from '@/context'
import { getProgress, setProgress, setRecords } from '@/routes/(app)/-shared/record'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { WordFrequency } from '@/shared/WordFrequency'

export const SurveyForm = (props: { survey: SurveySchema }) => {
  const { t } = useTranslation()
  const user = accountStore.user

  const [submitForm, { Form, Field }] = createForm<v.InferInput<typeof vSurveyAnswersSchema>>({
    initialValues: props.survey.questions.reduce(
      (acc, q) => {
        acc[String(q.id)] = ''
        return acc
      },
      {} as Record<string, string>,
    ),
    validate: valiForm(vSurveyAnswersSchema),
    validateOn: 'input',
    revalidateOn: 'input',
  })

  const submitAnswers = async (values: v.InferInput<typeof vSurveyAnswersSchema>) => {
    const api = user ? surveyV1Submit : surveyV1SubmitAnonymous
    await api({ path: { id: props.survey.id }, body: values })
    setProgress(props.survey.id, 100, accessContext())
    scrollTo(0, 0)
  }

  const questionRefs: Record<string, HTMLElement> = {}

  onMount(() => queueMicrotask(() => validate(submitForm)))

  onMount(async () => {
    // Because survey is outside of app route
    if (user) {
      createCachedStore(
        'learningV1GetRecords',
        () => ({}),
        async (options) => {
          const { data } = await learningV1GetRecords(options)
          setRecords(data)
          return data
        },
      )
    }
  })

  const submitted = () => !!getProgress(props.survey.id, accessContext())

  const [results] = createCachedStore(
    user ? 'surveyV1Results' : 'surveyV1ResultsAnonymous',
    () => (submitted() && props.survey.showResults ? { path: { id: props.survey.id } } : undefined),
    async (options) => {
      const api = user ? surveyV1Results : surveyV1ResultsAnonymous
      const { data } = await api(options)
      return data
    },
  )

  return (
    <>
      <Show when={submitted()}>
        <div class="w-full min-h-25 mb-8">
          <div role="alert" class="alert alert-success bg-success/50">
            <div>
              <div class="text-lg mb-2">{t('Thank you for your response!')}</div>
              <div class="">{props.survey.completeMessage}</div>
            </div>
          </div>
        </div>
      </Show>
      <Form onSubmit={submitAnswers}>
        <fieldset class="space-y-8" disabled={submitted()}>
          <For each={props.survey.questions}>
            {(question, i) => {
              const field = (
                <Field
                  name={String(question.id)}
                  transform={toCustom((value) => (typeof value === 'string' ? value.trim() : value), { on: 'blur' })}
                >
                  {(field, props) => {
                    let input: JSX.Element

                    if (question.format === 'single_choice') {
                      const questionId = String(question.id)
                      const selectionData = results.data?.[questionId] ?? {}
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

                      input = (
                        <div class="space-y-4 validator">
                          <For each={question.options}>
                            {(option, j) => (
                              <div class="flex items-center gap-8">
                                <label class="flex-1 label text-base text-base-content cursor-pointer flex gap-4 max-w-full">
                                  <input
                                    {...props}
                                    type="radio"
                                    checked={field.value === String(j() + 1)}
                                    class="radio radio-md"
                                    value={j() + 1}
                                    required={question.mandatory}
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
                    } else if (question.format === 'text_input') {
                      input = (
                        <div class="space-y-4">
                          <textarea
                            {...props}
                            value={field.value}
                            class="textarea w-full validator input-lg field-sizing-content"
                            placeholder={t('Write your answer here')}
                            required={question.mandatory}
                          />
                          <Show when={results.data?.[String(question.id)]}>
                            <WordFrequency frequencies={results.data?.[String(question.id)]} />
                          </Show>
                        </div>
                      )
                    } else if (question.format === 'number_input') {
                      input = (
                        <div class="space-y-4">
                          <input
                            {...props}
                            value={field.value}
                            type="number"
                            class="input w-full validator input-lg"
                            placeholder={t('Input your answer by number')}
                            required={question.mandatory}
                          />
                          <Show when={results.data?.[String(question.id)]}>
                            <WordFrequency frequencies={results.data?.[String(question.id)]} />
                          </Show>
                        </div>
                      )
                    }

                    return input
                  }}
                </Field>
              )

              return (
                <fieldset
                  ref={(el) => {
                    questionRefs[String(question.id)] = el
                  }}
                  class="fieldset border-base-300 rounded-box border p-4 pb-8 space-y-8"
                >
                  <legend class="badge badge-primary badge-sm fieldset-legend mb-2">
                    {t('Question {{num}}', { num: i() + 1 })}
                  </legend>
                  <div class="card-title text-base">{question.question}</div>

                  <Show when={question.supplement}>
                    <ContentViewer
                      content={question.supplement!}
                      class="bg-base-content/5 rounded-box p-8 w-full text-[1rem]"
                    />
                  </Show>

                  <div class="relative">
                    {field}
                    <div class="validator-hint absolute">{t('Required *')}</div>
                  </div>
                </fieldset>
              )
            }}
          </For>

          <Show when={!submitted()}>
            <div class="sticky bottom-8 w-full min-h-6">
              <Show when={submitForm.invalid}>
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

              <SubmitButton
                label={t('Submit Answers')}
                isPending={submitForm.submitting}
                disabled={submitForm.invalid} // cf. submitForm.dirty
                class="btn btn-primary w-full"
              />
            </div>
          </Show>
        </fieldset>
      </Form>
    </>
  )
}
