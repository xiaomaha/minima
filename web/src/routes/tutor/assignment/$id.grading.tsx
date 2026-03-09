import { IconCheck, IconHome } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, For, Match, Show, Switch } from 'solid-js'
import { tutorV1GetAssignmentGrades } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { useAllocation } from '../-context'
import { GradingProvider } from './-assignment/context'
import { GradingPaper } from './-assignment/GradingPaper'

export const Route = createFileRoute('/tutor/assignment/$id/grading')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const params = Route.useParams()
  const navigate = Route.useNavigate()

  const [allocations] = useAllocation()
  const currentGrading = () => allocations.items.find((item) => item.content.id === params().id)

  const gradingStore = createCachedInfiniteStore(
    'tutorV1GetAssignmentGrades',
    () => ({ path: { id: params().id } }),
    async (options, page) => (await tutorV1GetAssignmentGrades({ ...options, query: { page } })).data,
  )

  const [gradings, setObserverEl] = gradingStore

  const [activeGradingId, setActiveGradingId] = createSignal<number | undefined>()

  return (
    <GradingProvider value={gradingStore}>
      <div class="space-y-8">
        <div>
          <div class="breadcrumbs text-sm mb-8 **:text-base-content/60">
            <ul>
              <li>
                <span onclick={() => navigate({ to: '/tutor' })}>
                  <IconHome size={20} />
                </span>
              </li>
              <li>{currentGrading()?.content.title}</li>
            </ul>
          </div>

          <Show when={!gradings.loading}>
            <table class="table text-center text-base">
              <thead>
                <tr class="[&_th]:font-normal [&_th]:px-1">
                  <th class="w-12">#</th>
                  <th>{t('Learner')}</th>
                  <th>{t('Grading Due Date')}</th>
                  <th>{t('Retry')}</th>
                  <th>{t('Score')}</th>
                  <th>{t('Passed')}</th>
                  <th>{t('Completed')}</th>
                  <th>{t('Confirmed')}</th>
                  <th>{t('Status')}</th>
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
                        <td>
                          <div class="avatar avatar-placeholder tooltip" data-tip={t('Anonymous')}>
                            <div class="bg-base-content/10 w-10 rounded-full">A</div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div>
                              {t('Grading')}: {new Date(item.gradingDate.gradeDue).toLocaleDateString()}
                            </div>
                            <div>
                              {t('Appeal')}: {new Date(item.gradingDate.appealDeadline).toLocaleDateString()}
                            </div>
                            <div>
                              {t('Confirm')}: {new Date(item.gradingDate.confirmDue).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td>{item.attemptRetry || ''}</td>
                        <td>{item.score.toFixed(2)}</td>
                        <td>
                          <Show when={item.passed}>
                            <IconCheck class="text-success" />
                          </Show>
                        </td>
                        <td>{item.completed ? new Date(item.completed).toLocaleString() : ''}</td>
                        <td>{item.confirmed ? new Date(item.confirmed).toLocaleString() : ''}</td>
                        <td>
                          <Switch>
                            <Match when={!item.confirmed}>
                              <span class="status status-warning" />
                            </Match>
                            <Match when={true}>
                              <span class="status status-success" />
                            </Match>
                          </Switch>
                        </td>
                      </tr>
                      <Show when={activeGradingId() === item.id}>
                        <tr class="bg-base-content/40">
                          <td colspan={10} class="w-0 p-0 border-none">
                            <GradingPaper assignmentId={params().id} gradingId={item.id} />
                          </td>
                        </tr>
                      </Show>
                    </>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </div>

        <Show when={gradings.end && gradings.count === 0}>
          <NoContent message={t('No assignment grading yet.')} />
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
