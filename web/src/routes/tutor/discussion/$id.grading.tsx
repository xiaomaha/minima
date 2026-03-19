import { IconCheck } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, For, Show } from 'solid-js'
import { tutorV1GetDiscussionGrades, tutorV1GetModelInfo } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { RefreshButton } from '@/shared/RefreshButton'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Breadcrumb } from '../-tutor/Breadcrumb'
import { GradingProvider } from './-discussion/context'
import { GradingPaper } from './-discussion/GradingPaper'

export const Route = createFileRoute('/tutor/discussion/$id/grading')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const params = Route.useParams()

  const [info] = createCachedStore(
    'tutorV1GetModelInfo',
    () => ({ path: { app_label: 'discussion', model: 'discussion', id: params().id } }),
    async (options) => (await tutorV1GetModelInfo(options)).data,
  )

  const gradingStore = createCachedInfiniteStore(
    'tutorV1GetDiscussionGrades',
    () => ({ path: { id: params().id } }),
    async (options, page) => (await tutorV1GetDiscussionGrades({ ...options, query: { page } })).data,
  )

  const [gradings, setObserverEl, { refetch }] = gradingStore

  const [activeGradingId, setActiveGradingId] = createSignal<number | undefined>()

  return (
    <GradingProvider value={gradingStore}>
      <div class="space-y-8">
        <Breadcrumb app="discussion" id={params().id!} title={info.data?.title ?? ''} kind="grading" />

        <div class="text-right">
          <RefreshButton refresh={refetch} loading={gradings.loading} />
        </div>

        <Show when={gradings.items.length > 0}>
          <table class="table text-base">
            <thead>
              <tr class="[&_th]:font-normal">
                <th class="w-12">#</th>
                <th>{t('Grading Due')}</th>
                <th>{t('Appeal Deadline')}</th>
                <th>{t('Confirm Due')}</th>
                <th>{t('Retry')}</th>
                <th>{t('Score')}</th>
                <th>{t('Passed')}</th>
                <th>{t('Completed')}</th>
                <th>{t('Confirmed')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={gradings.items}>
                {(item, i) => (
                  <>
                    <tr
                      class="hover:bg-base-200 cursor-pointer"
                      classList={{ 'bg-base-200': activeGradingId() === item.id }}
                      onClick={() => setActiveGradingId((prev) => (prev === item.id ? undefined : item.id))}
                    >
                      <td>{gradings.count - i()}</td>
                      <td>{new Date(item.gradingDate.gradeDue).toLocaleDateString()}</td>
                      <td>{new Date(item.gradingDate.appealDeadline).toLocaleDateString()}</td>
                      <td>{new Date(item.gradingDate.confirmDue).toLocaleDateString()}</td>
                      <td>{item.attemptRetry || ''}</td>
                      <td>{item.score.toFixed(2)}</td>
                      <td>
                        <Show when={item.passed}>
                          <IconCheck class="text-success" />
                        </Show>
                      </td>
                      <td>{item.completed ? new Date(item.completed).toLocaleString() : ''}</td>
                      <td title={item.confirmed ? new Date(item.confirmed).toLocaleString() : t('Not confirmed')}>
                        <Show when={item.confirmed} fallback={<span class="status status-warning" />}>
                          <span class="status status-success" />
                        </Show>
                      </td>
                    </tr>
                    <Show when={activeGradingId() === item.id}>
                      <tr class="bg-base-content/40">
                        <td colspan={10} class="w-0 p-0 border-none">
                          <GradingPaper discussionId={params().id} gradingId={item.id} />
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </Show>

        <Show when={gradings.end && gradings.count === 0}>
          <NoContent message={t('No discussion grading yet.')} />
        </Show>

        <Show when={!gradings.end}>
          <div ref={setObserverEl} class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>
      </div>
    </GradingProvider>
  )
}
