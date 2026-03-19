import { IconCornerDownRightDouble, IconMessage, IconPencilPlus } from '@tabler/icons-solidjs'
import { createEffect, For, Show } from 'solid-js'
import { reconcile } from 'solid-js/store'
import { tutorV1CompleteDiscussionGrade, tutorV1GetDiscussionGradePaper } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { NoContent } from '@/shared/NoContent'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { useGrading } from './context'
import { Question } from './Question'

interface Props {
  discussionId: string
  gradingId: number
}

export const GradingPaper = (props: Props) => {
  const { t } = useTranslation()

  const [grading, { setStore }] = createCachedStore(
    'tutorV1GetDiscussionGradePaper',
    () => ({ path: { id: props.discussionId, grade_id: props.gradingId } }),
    async (options) => (await tutorV1GetDiscussionGradePaper(options)).data,
  )

  const [formState, { Form, Field, reset, getValue }] = createForm<{ point: string | number; feedback: string }>({
    initialValues: { point: '', feedback: '' },
  })

  createEffect(() => {
    if (!grading.data) return
    reset({
      initialValues: {
        point: String(grading.data.earnedDetails.tutorAssessment ?? ''),
        feedback: grading.data.feedback.tutorAssessment ?? '',
      },
    })
  })

  const gradingContext = useGrading()

  const saveGrade = async (values: { point: string | number; feedback: string }) => {
    const earnedDetails = { tutorAssessment: Number(values.point) }
    const feedback = { tutorAssessment: values.feedback }

    const { data } = await tutorV1CompleteDiscussionGrade({
      path: { id: props.discussionId, grade_id: props.gradingId },
      body: { earnedDetails, feedback },
    })

    // cache
    setStore(
      'data',
      reconcile({
        ...grading.data!,
        ...data,
        feedback,
        earnedDetails: { ...grading.data!.earnedDetails!, ...earnedDetails },
      }),
    )
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
        <div class="m-8 p-8 bg-base-100 rounded space-y-8">
          <Question question={grading.data!.question} />

          <div class="divider" />

          <div>
            <div class="label mb-2">{t("Learner's Posts")}</div>

            <div class="space-y-2 max-h-200 overflow-y-scroll border border-accent rounded-box p-8">
              <For
                each={grading.data!.posts}
                fallback={<NoContent message={t('No posts yet.')} small icon={IconMessage} />}
              >
                {(post, i) => (
                  <>
                    <Show when={i() !== 0}>
                      <div class="divider my-4" />
                    </Show>
                    <div class="space-y-4">
                      <div class="font-semibold flex items-center gap-2">
                        <Show when={post.parentId} fallback={<IconPencilPlus size={20} />}>
                          <IconCornerDownRightDouble size={20} />
                        </Show>
                        {post.title}
                      </div>
                      <ContentViewer content={post.body} class="rounded-box text-sm" />
                    </div>
                  </>
                )}
              </For>
            </div>
          </div>

          <div class="divider" />

          <fieldset disabled={!!grading.data!.confirmed}>
            <table class="table">
              <tbody>
                <tr>
                  <th></th>
                  <td class="flex gap-4 items-center">
                    <div>
                      {t('Tutor Assessment: {{count}}', { count: Number(getValue('point') || 0) })} {' / '}{' '}
                      {grading.data!.question.tutorAssessmentPoint}
                    </div>
                    <div>
                      {t('Post Point: {{count}}', { count: grading.data!.earnedDetails.post })} {' / '}{' '}
                      {grading.data!.question.postPoint}
                    </div>
                    <div>
                      {t('Reply Point: {{count}}', { count: grading.data!.earnedDetails.reply })} {' / '}
                      {grading.data!.question.replyPoint}
                    </div>
                  </td>
                </tr>
                <tr>
                  <th>{t('Points')}</th>
                  <td>
                    <Field
                      name="point"
                      validate={(v) =>
                        !String(v) || Number(v) < 0 || Number(v) > grading.data!.question.tutorAssessmentPoint
                          ? t('Invalid point')
                          : ''
                      }
                    >
                      {(field, props) => (
                        <div>
                          <input
                            {...props}
                            value={field.value ?? ''}
                            type="number"
                            class="input bg-amber-100 border-0 w-xs validator"
                            placeholder={`0 ~ ${grading.data!.question.tutorAssessmentPoint}`}
                            required
                            min={0}
                            max={grading.data!.question.tutorAssessmentPoint}
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
                    <Field name="feedback" validate={(v) => (v.trim().length === 0 ? t('Feedback is required') : '')}>
                      {(field, props) => (
                        <div>
                          <textarea
                            {...props}
                            value={field.value ?? ''}
                            class="bg-amber-100 textarea w-full field-sizing-content border-0 validator"
                            required
                            minLength={1}
                            placeholder={t('required *')}
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
        <Show when={!grading.data!.confirmed}>
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
