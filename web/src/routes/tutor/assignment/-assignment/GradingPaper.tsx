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
  })

  createEffect(() => {
    if (!grading.data) return

    const flatFields = Object.entries(grading.data!.earnedDetails).reduce(
      (acc, [key, value]) => {
        acc.feedback[`feedback.${key}`] = grading.data!.feedback[key] ?? ''
        acc.earnedDetails[key] = String(value) ?? ''
        return acc
      },
      { earnedDetails: {} as Record<string, string | number>, feedback: {} as Record<string, string> },
    )
    reset({ initialValues: { ...flatFields.earnedDetails, ...flatFields.feedback } })
  })

  const gradingContext = useGrading()

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

    if (gradingContext) {
      const idx = gradingContext[0].items!.findIndex((g) => g.id === props.gradingId)
      if (idx !== -1) gradingContext[2].setStore('items', idx, data)
    }

    // form reset
    reset({ initialValues: { ...values } })
  }

  const earned = () =>
    rubric.data?.criteria.map((c) => getValue(c.name)).reduce((acc, cur) => Number(acc) + Number(cur), 0)

  return (
    <Show when={grading.data}>
      <Form onSubmit={saveGrade}>
        <div class="text-left m-8 p-8 bg-base-100 rounded space-y-8">
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

          <fieldset
            disabled={!gradingContext || !!gradingContext[0].items.find((g) => g.id === props.gradingId)?.confirmed}
          >
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
                          <Field name={`feedback.${criterion.name}`} validate={(v) => (v === '' ? t('required') : '')}>
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
                                        checked={String(field.value) === String(level.point)}
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
        <Show when={gradingContext}>
          <div class="text-center mb-8 mr-8">
            <SubmitButton
              label={t('Complete Grade')}
              isPending={formState.submitting}
              disabled={!formState.dirty}
              class="btn btn-primary min-w-40"
            />
          </div>
        </Show>
      </Form>
    </Show>
  )
}
