import { createFileRoute, notFound } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createEffect, createSignal, For, Match, Show, Switch } from 'solid-js'
import { tutorV1GetAppeals, tutorV1GetModelInfo, tutorV1ReviewAppeal } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { NoContent } from '@/shared/NoContent'
import { RefreshButton } from '@/shared/RefreshButton'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'
import { Breadcrumb } from './-tutor/Breadcrumb'
import { GradingPaper as AssignmentGradingPaper } from './assignment/-assignment/GradingPaper'
import { GradingPaper as DiscussionGradingPaper } from './discussion/-discussion/GradingPaper'
import { GradingPaper as ExamGradingPaper } from './exam/-exam/GradingPaper'

export const Route = createFileRoute('/tutor/$app/$id/appeal')({
  beforeLoad: ({ params }) => {
    if (!['exam', 'assignment', 'discussion'].includes(params.app)) {
      throw notFound()
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const params = Route.useParams()

  const [info] = createCachedStore(
    'tutorV1GetModelInfo',
    () => ({ path: { app_label: params().app, model: params().app, id: params().id } }),
    async (options) => (await tutorV1GetModelInfo(options)).data,
  )

  const [appeals, setObserverEl, { setStore, refetch }] = createCachedInfiniteStore(
    'tutorV1GetAppeals',
    () => {
      const app = params().app as 'exam' | 'assignment' | 'discussion'
      return { path: { app_label: app, model: app, id: params().id } }
    },
    async (options, page) => (await tutorV1GetAppeals({ ...options, query: { page } })).data,
  )

  const [activeAppealId, setActiveAppealId] = createSignal<number | undefined>()

  const [formState, { Form, Field, reset }] = createForm({
    initialValues: { review: '' },
  })

  createEffect(() => {
    if (!activeAppealId()) return
    const appeal = appeals.items.find((a) => a.id === activeAppealId())
    if (!appeal) return
    reset({ initialValues: { review: appeal.review } })
  })

  const submitReview = async ({ review }: { review: string }) => {
    if (!activeAppealId()) return
    await tutorV1ReviewAppeal({ path: { id: activeAppealId()! }, body: { review } })
    reset({ initialValues: { review } })
    setStore('items', (prev) => prev.id === activeAppealId(), 'review', review)
  }

  return (
    <Form onSubmit={submitReview}>
      <div class="space-y-8">
        <Breadcrumb app={params().app} id={params().id!} title={info.data?.title ?? ''} kind="appeal" />

        <div class="text-right">
          <RefreshButton refresh={refetch} loading={appeals.loading} />
        </div>

        <Show when={appeals.items.length > 0}>
          <table class="table text-base">
            <thead>
              <tr class="[&_th]:font-normal">
                <th class="w-12">#</th>
                <th>{t('Created')}</th>
                <th>{t('Modified')}</th>
                <th>{t('Explanation')}</th>
                <th>{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={appeals.items}>
                {(item, i) => (
                  <>
                    <tr
                      class="hover:bg-base-200 cursor-pointer"
                      classList={{ 'bg-base-200': activeAppealId() === item.id }}
                      onClick={() => setActiveAppealId((prev) => (prev === item.id ? undefined : item.id))}
                    >
                      <td>{appeals.count - i()}</td>
                      <td class="whitespace-nowrap">{new Date(item.created).toLocaleString()}</td>
                      <td class="whitespace-nowrap">{formatDistanceToNow(item.modified, { addSuffix: true })}</td>
                      <td>
                        <div class="line-clamp-1 text-base-content/80">{extractText(item.explanation)}</div>
                      </td>
                      <td>
                        <Show when={item.review} fallback={<span class="status status-warning" />}>
                          <span class="status status-success" />
                        </Show>
                      </td>
                    </tr>
                    <Show when={activeAppealId() === item.id}>
                      <tr class="bg-base-content/40">
                        <td colspan={10} class="w-0 p-0 border-none">
                          <div class="m-8 p-8 bg-base-100 rounded space-y-8">
                            <table class="table">
                              <tbody>
                                <tr>
                                  <th>{t("Learner's explanation")}</th>
                                  <td>
                                    <ContentViewer
                                      content={item.explanation}
                                      class="rounded bg-base-200 p-4 max-h-200 overflow-y-auto"
                                    />
                                  </td>
                                </tr>
                                <tr>
                                  <th>{t('Review')}</th>
                                  <td class="flex gap-4 items-center">
                                    <Field
                                      name="review"
                                      validate={(v) => (v.trim().length === 0 ? t('Select review option') : '')}
                                    >
                                      {(field, props) => (
                                        <div class="flex-1">
                                          <For
                                            each={[
                                              t('Appeal accepted – your grade will be revised'),
                                              t('Appeal rejected – your grade will remain unchanged'),
                                            ]}
                                          >
                                            {(option, i) => (
                                              <label class="label w-full hover:bg-base-200 text-base-content/90 has-checked:bg-base-300">
                                                <div
                                                  class="flex w-full px-4 py-3 gap-4 items-center rounded"
                                                  classList={{ 'border-t border-base-content/5': i() !== 0 }}
                                                >
                                                  <input
                                                    {...props}
                                                    type="radio"
                                                    class="radio"
                                                    value={option}
                                                    checked={field.value === option}
                                                  />
                                                  <div class="flex-1">{option}</div>
                                                </div>
                                              </label>
                                            )}
                                          </For>
                                        </div>
                                      )}
                                    </Field>
                                    <SubmitButton
                                      label={t('Save Review')}
                                      isPending={formState.submitting}
                                      disabled={!formState.dirty}
                                      class="btn btn-primary min-w-40"
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <Switch>
                            <Match when={params().app === 'discussion'}>
                              <DiscussionGradingPaper discussionId={params().id} gradingId={item.gradeId} />
                            </Match>
                            <Match when={params().app === 'assignment'}>
                              <AssignmentGradingPaper assignmentId={params().id} gradingId={item.gradeId} />
                            </Match>
                            <Match when={params().app === 'exam'}>
                              <ExamGradingPaper
                                examId={params().id}
                                gradingId={item.gradeId}
                                questionId={item.questionId}
                              />
                            </Match>
                          </Switch>
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </Show>

        <Show when={appeals.end && appeals.count === 0}>
          <NoContent message={t('No grading appeal yet.')} />
        </Show>

        <Show when={!appeals.end}>
          <div ref={setObserverEl} class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>
      </div>
    </Form>
  )
}
