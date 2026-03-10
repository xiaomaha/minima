import { createEffect, For, Show } from 'solid-js'
import { reconcile } from 'solid-js/store'
import { tutorV1CompleteExamGrade, tutorV1GetExamGradePaper } from '@/api'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { useGrading } from './context'
import { Question } from './Question'

interface Props {
  examId: string
  gradingId: number
  questionId?: number
}

export const GradingPaper = (props: Props) => {
  const { t } = useTranslation()

  const [grading, { setStore }] = createCachedStore(
    'tutorV1GetExamGradePaper',
    () => ({ path: { id: props.examId, grade_id: props.gradingId }, query: { questionId: props.questionId } }),
    async (options) => (await tutorV1GetExamGradePaper(options)).data,
  )

  const [formState, { Form, Field, reset }] = createForm<Record<string, string | number>>({
    initialValues: {},
    validateOn: 'input',
    revalidateOn: 'input',
  })

  createEffect(() => {
    const flatFields: Record<string, string | number> = {}
    grading.data?.questions.forEach((q) => {
      flatFields[`earnedDetails.${q.id}`] = String(grading.data?.earnedDetails[q.id] ?? '')
      flatFields[`feedback.${q.id}`] = grading.data?.feedback[q.id] ?? ''
    })
    reset({ initialValues: flatFields })
  })

  const gradingContext = useGrading()

  const saveGrade = async (values: Record<string, string | number>) => {
    const earnedDetails: Record<string, number> = {}
    const feedback: Record<string, string> = {}

    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith('earnedDetails.')) {
        earnedDetails[key.slice('earnedDetails.'.length)] = Number(value)
      } else if (key.startsWith('feedback.')) {
        feedback[key.slice('feedback.'.length)] = value as string
      }
    }

    const { data } = await tutorV1CompleteExamGrade({
      path: { id: props.examId, grade_id: props.gradingId },
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

  return (
    <Show when={grading.data}>
      <Form onSubmit={saveGrade}>
        <For each={grading.data!.questions}>
          {(question) => (
            <div class="text-left m-8 p-8 bg-base-100 rounded">
              <Question
                question={question}
                solution={question.solution}
                analysis={grading.data!.analysis[question.id]}
              />

              <div class="divider" />

              <fieldset
                disabled={!gradingContext || !!gradingContext[0].items.find((g) => g.id === props.gradingId)?.confirmed}
              >
                <table class="table table-sm">
                  <tbody>
                    <tr>
                      <th class="w-0 whitespace-nowrap">{t("Learner's Answer")}</th>
                      <td>{grading.data!.answers[question.id]}</td>
                    </tr>
                    <tr>
                      <th>{t('Points')}</th>
                      <td>
                        <Field
                          name={`earnedDetails.${question.id}`}
                          validate={(v) =>
                            !String(v) || Number(v) < 0 || Number(v) > question.point ? t('Invalid point') : ''
                          }
                        >
                          {(field, props) => (
                            <div>
                              <input
                                {...props}
                                value={field.value ?? ''}
                                type="number"
                                class="input bg-amber-100 border-0 w-xs validator"
                                placeholder={`0 ~ ${question.point}`}
                                required
                                min={0}
                                max={question.point}
                              />
                              <div class="text-error font-normal">{field.error}</div>
                            </div>
                          )}
                        </Field>
                      </td>
                    </tr>
                    <tr>
                      <th>{t('Feedback')}</th>
                      <td>
                        <Field
                          name={`feedback.${question.id}`}
                          validate={(v) => {
                            if (question.format === 'essay' && String(v).trim().length === 0) {
                              return t('Feedback is required')
                            }
                            return ''
                          }}
                        >
                          {(field, props) => (
                            <div>
                              <textarea
                                {...props}
                                value={field.value ?? ''}
                                class="bg-amber-100 textarea w-full field-sizing-content border-0 validator"
                                required={question.format === 'essay'}
                                minLength={question.format === 'essay' ? 1 : 0}
                                placeholder={question.format === 'essay' ? t('required *') : ''}
                              />
                              <div class="text-error">{field.error}</div>
                            </div>
                          )}
                        </Field>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </fieldset>
            </div>
          )}
        </For>
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
