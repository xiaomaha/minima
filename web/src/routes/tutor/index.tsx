import { IconHelp, IconHome } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { For, Match, Show, Switch } from 'solid-js'
import { tutorV1GetAllocationStats } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'
import { useAllocation } from './-context'

export const Route = createFileRoute('/tutor/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const [stats] = createCachedStore(
    'tutorV1GetAllocationStats',
    () => ({}),
    async () => (await tutorV1GetAllocationStats()).data,
  )

  const [allocations, setObserverEl] = useAllocation()

  const previewContent = (model: string, id: string) => {
    navigate({ to: `/${model}/${id}/session?mode=preview` })
  }

  const goToGradingList = (model: string, id: string) => {
    navigate({ to: `/tutor/${model}/${id}/grading` })
  }

  const goToAppealList = (model: string, id: string) => {
    navigate({ to: `/tutor/${model}/${id}/appeal` })
  }

  const statsData = () => [
    { title: 'Allocated', value: (stats.data?.allocationCount ?? '').toLocaleString() },
    { title: 'Submissions', value: (stats.data?.submissionCount ?? '').toLocaleString() },
    { title: 'Completed', value: (stats.data?.gradeCompletedCount ?? '').toLocaleString() },
    { title: 'Confirmed', value: (stats.data?.gradeConfirmedCount ?? '').toLocaleString() },
    {
      title: 'Appeals',
      value: `${stats.data?.appealOpenCount ?? ''} / ${stats.data?.appealCount ?? ''}`.toLocaleString(),
    },
  ]

  return (
    <div class="space-y-8">
      <div class="breadcrumbs text-sm mb-8 **:text-base-content/60">
        <ul>
          <li>
            <IconHome size={20} />
          </li>
        </ul>
      </div>

      <div class="text-center">
        <div class="stats shadow mb-8 text-base-content/80">
          <For each={statsData()}>
            {(item) => (
              <div class="stat place-items-center">
                <div class="stat-title">{item.title}</div>
                <div class="stat-value min-h-12 min-w-20">{item.value}</div>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={!allocations.loading}>
        <table class="table text-center">
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
                <tr class="hover:bg-base-200">
                  <td>{allocations.count - i()}</td>
                  <td>{t(capitalize(item.contentType.model))}</td>
                  <td class="text-left">
                    <span
                      class="link decoration-base-content/30"
                      onclick={() => previewContent(item.contentType.model, item.content.id)}
                    >
                      {item.content.title}
                    </span>
                  </td>
                  <td class="text-xs">
                    {item.content.lastGrading
                      ? formatDistanceToNow(new Date(item.content.lastGrading), { addSuffix: true })
                      : ''}
                  </td>
                  <td>
                    <span
                      class="link decoration-base-content/30"
                      onclick={() => goToGradingList(item.contentType.model, item.content.id)}
                    >
                      {item.content.submissionCount}
                      {' / '}
                      {item.content.gradeCompletedCount}
                      {' / '}
                      {item.content.gradeConfirmedCount}
                    </span>
                  </td>
                  <td>
                    <span
                      class="link decoration-base-content/30"
                      onclick={() => goToAppealList(item.contentType.model, item.content.id)}
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
