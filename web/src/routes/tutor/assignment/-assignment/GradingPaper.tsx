import { createEffect, For, Show } from 'solid-js'
import { reconcile } from 'solid-js/store'
import { tutorV1CompleteAssignmentGrade, tutorV1GetAssignmentGradePaper, tutorV1GetAssignmentRubric } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { useGrading } from './context'
import { Question } from './Question'

interface Props {
  assignmentId: string
  gradingId: number
}

export const GradingPaper = (props: Props) => {
  const { t } = useTranslation()

  const [grading, { setStore }] = createCachedStore(
    'tutorV1GetAssignmentGradePaper',
    () => ({ path: { id: props.assignmentId, grade_id: props.gradingId } }),
    async (options) => (await tutorV1GetAssignmentGradePaper(options)).data,
  )

  const [rubric] = createCachedStore(
    'tutorV1GetAssignmentRubric',
    () => ({ path: { id: props.assignmentId } }),
    async (options) => (await tutorV1GetAssignmentRubric(options)).data,
  )

  const [formState, { Form, Field, reset, getValue }] = createForm<Record<string, string | number>>({
    initialValues: {},
    validateOn: 'input',
    revalidateOn: 'input',
  })

  createEffect(() => {
    if (!grading.data) return

    const flatFields = Object.entries(grading.data!.earnedDetails).reduce(
      (acc, [key, value]) => {
        acc.feedback[`feedback.${key}`] = grading.data!.feedback[key] ?? ''
        acc.earnedDetails[key] = value ?? ''
        return acc
      },
      { earnedDetails: {} as Record<string, string | number>, feedback: {} as Record<string, string> },
    )
    reset({ initialValues: { ...flatFields.earnedDetails, ...flatFields.feedback } })
  })

  const [gradingStore, , { setStore: setGradingStore }] = useGrading()

  const saveGrade = async (values: Record<string, string | number>) => {
    const feedback: Record<string, string> = {}
    const earnedDetails: Record<string, number> = {}

    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith('feedback.')) {
        feedback[key.slice('feedback.'.length)] = value as string
      } else {
        earnedDetails[key] = Number(value)
      }
    }

    const { data } = await tutorV1CompleteAssignmentGrade({
      path: { id: props.assignmentId, grade_id: props.gradingId },
      body: { earnedDetails, feedback },
    })

    // cache
    setStore('data', reconcile({ ...grading.data!, ...data, feedback, earnedDetails }))
    const idx = gradingStore.items!.findIndex((g) => g.id === props.gradingId)
    if (idx !== -1) setGradingStore('items', idx, data)

    // form reset
    reset({ initialValues: { ...values } })
  }

  const earned = () =>
    rubric.data?.criteria.map((c) => getValue(c.name)).reduce((acc, cur) => Number(acc) + Number(cur), 0)

  return (
    <Show when={grading.data}>
      <Form onSubmit={saveGrade}>
        <SubmitButton
          label={t('Complete Grade')}
          isPending={formState.submitting}
          disabled={!formState.dirty}
          class="btn btn-primary sticky top-20 z-10 block min-w-40 ml-auto mr-9 mt-8 rounded-full"
        />
        <div class="text-left space-y-8 p-8">
          <div class="px-8 py-8 bg-base-100 rounded space-y-8">
            <Question question={grading.data!.question} analysis={grading.data!.analysis[grading.data!.question.id]} />

            <div class="divider" />

            <div>
              <div class="label mb-2">{t("Learner's Answer")}</div>
              <ContentViewer content={grading.data!.answer} class="bg-base-content/5 rounded-box p-4" />
            </div>

            <div>
              <div class="label mb-2">{t('Similar Answer')}</div>
              <Show when={grading.data!.similarAnswer} fallback={<div>{t('No similar answer found')}</div>}>
                <ContentViewer content={grading.data!.similarAnswer!} class="bg-base-content/5 rounded-box p-4" />
              </Show>
            </div>

            <div class="divider" />

            <fieldset disabled={!!gradingStore.items.find((g) => g.id === props.gradingId)?.confirmed}>
              <div class="label mb-2 w-full">
                {t('Grading Rubric')}
                <span class="ml-auto mx-6 text-primary font-semibold">
                  {earned()} / {rubric.data?.possiblePoint}
                </span>
              </div>
              <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
                <table class="table">
                  <tbody>
                    <For each={rubric.data?.criteria}>
                      {(criterion) => (
                        <tr>
                          <td class="min-w-80">
                            <div class="mb-2">{t(criterion.name)}</div>
                            <Field
                              name={`feedback.${criterion.name}`}
                              validate={(v) => (v === '' ? t('required') : '')}
                            >
                              {(field, props) => (
                                <div>
                                  <textarea
                                    {...props}
                                    value={field.value ?? ''}
                                    class="textarea w-full bg-amber-100 border-0 validator"
                                    required
                                  />
                                  <div class="text-error">{field.error}</div>
                                </div>
                              )}
                            </Field>
                          </td>

                          <td>
                            <For each={criterion.performanceLevels}>
                              {(level, i) => (
                                <Field
                                  name={criterion.name}
                                  validate={(v) => {
                                    return criterion.performanceLevels.map((l) => l.point).includes(Number(v))
                                      ? ''
                                      : t('Invalid point')
                                  }}
                                >
                                  {(field, props) => (
                                    <label class="label w-full hover:bg-base-200 text-base-content/90 has-checked:bg-base-300">
                                      <div
                                        class="flex w-full p-4 gap-4 items-center"
                                        classList={{ 'border-t border-base-content/5': i() !== 0 }}
                                      >
                                        <div class="flex-1">{t(level.name)}</div>
                                        <div class="badge badge-xs badge-primary text-base-100">
                                          {t('{{count}} point', { count: level.point })}
                                        </div>
                                        <input
                                          {...props}
                                          type="radio"
                                          class="radio"
                                          value={level.point}
                                          checked={Number(field.value) === Number(level.point)}
                                          classList={{ 'radio-error': !!field.error }}
                                        />
                                      </div>
                                    </label>
                                  )}
                                </Field>
                              )}
                            </For>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>
        </div>
      </Form>
    </Show>
  )
}
