import { IconHelp, IconHome } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { For, Match, Show, Switch } from 'solid-js'
import { tutorV1GetAllocationStats } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { RefreshButton } from '@/shared/RefreshButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'
import { useAllocation } from './-tutor/context'

export const Route = createFileRoute('/tutor/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const [stats, { refetch: refetchStats }] = createCachedStore(
    'tutorV1GetAllocationStats',
    () => ({}),
    async () => (await tutorV1GetAllocationStats()).data,
  )

  const [allocations, setObserverEl, { refetch: refetchAllocations }] = useAllocation()

  const goToGradingList = (app: 'exam' | 'assignment' | 'discussion', id: string) => {
    if (app === 'exam') {
      navigate({ to: '/tutor/exam/$id/grading', params: { id } })
    } else if (app === 'assignment') {
      navigate({ to: '/tutor/assignment/$id/grading', params: { id } })
    } else if (app === 'discussion') {
      navigate({ to: '/tutor/discussion/$id/grading', params: { id } })
    }
  }

  const goToAppealList = (app: string, id: string) => {
    navigate({ to: '/tutor/$app/$id/appeal', params: { app, id } })
  }

  const statsData = () => [
    { title: 'Allocated', value: (stats.data?.allocationCount ?? '').toLocaleString() },
    { title: 'Submissions', value: (stats.data?.submissionCount ?? '').toLocaleString() },
    { title: 'Completed', value: (stats.data?.gradeCompletedCount ?? '').toLocaleString() },
    { title: 'Confirmed', value: (stats.data?.gradeConfirmedCount ?? '').toLocaleString() },
    { title: 'Open appeals', value: (stats.data?.appealOpenCount ?? '').toLocaleString() },
  ]

  const refresh = async () => {
    await refetchAllocations()
    await refetchStats()
  }

  return (
    <div class="space-y-8">
      <div class="breadcrumbs mb-8">
        <ul>
          <li class="flex items-center gap-4">
            <IconHome size={20} />
            {t('Tutor')}
          </li>
        </ul>
      </div>

      <div class="text-center">
        <div class="stats shadow text-base-content/80">
          <For each={statsData()}>
            {(item) => (
              <div class="stat place-items-center">
                <div class="stat-title">{item.title}</div>
                <div
                  class="stat-value min-h-12 min-w-20"
                  classList={{
                    'text-error': item.title === 'Open appeals' && stats.data?.appealOpenCount !== 0,
                  }}
                >
                  {item.value}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="text-right">
        <RefreshButton refresh={refresh} loading={allocations.loading || stats.loading} />
      </div>

      <Show when={!allocations.loading || allocations.items.length > 0}>
        <table class="table text-center text-base">
          <thead>
            <tr class="[&_th]:font-normal [&_th]:px-1">
              <th class="w-12">#</th>
              <th>{t('Type')}</th>
              <th>{t('Title')}</th>
              <th>{t('Last grading')}</th>
              <th>
                {t('Gradings')}
                <span
                  class="tooltip align-middle ml-1"
                  data-tip={t('Submissions / Grading completed / Grading confirmed')}
                >
                  <IconHelp size={16} />
                </span>
              </th>
              <th>
                {t('Appeals')}
                <span class="tooltip align-middle ml-1" data-tip={t('Not reviewed / All appeals')}>
                  <IconHelp size={16} />
                </span>
              </th>
              <th>{t('Status')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={allocations.items}>
              {(item, i) => (
                <tr
                  class="hover:bg-base-200 cursor-pointer"
                  onClick={() => goToGradingList(item.contentType.model, item.content.id)}
                >
                  <td>{allocations.count - i()}</td>
                  <td>{t(capitalize(item.contentType.model))}</td>
                  <td class="text-left">{item.content.title}</td>
                  <td class="text-sm">
                    {item.content.lastGrading
                      ? formatDistanceToNow(new Date(item.content.lastGrading), { addSuffix: true })
                      : ''}
                  </td>
                  <td>
                    {item.content.submissionCount}
                    {' / '}
                    {item.content.gradeCompletedCount}
                    {' / '}
                    {item.content.gradeConfirmedCount}
                  </td>
                  <td>
                    <span
                      class="link link-primary link-hover decoration-base-content/30 flex items-center gap-2"
                      onclick={(e) => {
                        e.stopPropagation()
                        goToAppealList(item.contentType.model, item.content.id)
                      }}
                    >
                      {item.content.appealOpenCount} / {item.content.appealCount}
                    </span>
                  </td>
                  <td>
                    <Switch>
                      <Match when={item.content.appealOpenCount > 0}>
                        <span class="status status-error" />
                      </Match>
                      <Match when={item.content.submissionCount !== item.content.gradeConfirmedCount}>
                        <span class="status status-warning" />
                      </Match>
                      <Match when={item.content.submissionCount !== 0}>
                        <span class="status status-success" />
                      </Match>
                    </Switch>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={allocations.end && allocations.count === 0}>
        <NoContent message={t('No grading yet.')} />
      </Show>

      <Show when={!allocations.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </Show>
    </div>
  )
}
