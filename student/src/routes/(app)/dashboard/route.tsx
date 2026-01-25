import { IconRefresh } from '@tabler/icons-solidjs'
import { createFileRoute, Outlet, useLocation } from '@tanstack/solid-router'
import { createSignal, For, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { DashboardProvider } from './-context'

export const Route = createFileRoute('/(app)/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const location = useLocation()

  const tabLabels: Record<string, string> = {
    learning: t('Learning'),
    catalog: t('Catalog'),
    search: t('Search'),
    goal: t('goal'),
    achievement: t('Achievement'),
    announcement: t('Announcement'),
    inquiry: t('1:1 Inquiry'),
    report: t('Report'),
  } as const

  const currentTab = () => {
    const path = location().pathname.split('/').pop()
    return path
  }

  const [refreshHandler, setRefreshHandler] = createSignal<(() => void) | undefined>()

  return (
    <DashboardProvider value={{ newEnrollments: [], setRefreshHandler }}>
      <div class="mx-auto max-w-7xl p-4">
        <div class="flex items-center mb-6 gap-4">
          <ul class="menu menu-sm  menu-horizontal bg-base-200 rounded-box mb-0 space-x-2 gap-y-2">
            <For each={Object.keys(tabLabels)}>
              {(tab) => (
                <li class="mb-0">
                  <button
                    type="button"
                    class="min-w-16 justify-center"
                    classList={{ 'menu-active': currentTab() === tab }}
                    onClick={() => navigate({ to: `/dashboard/${tab}` })}
                  >
                    {tabLabels[tab]}
                  </button>
                </li>
              )}
            </For>
          </ul>
          <Show when={refreshHandler()}>
            <button type="button" class="btn btn-sm btn-ghost btn-circle" onClick={() => refreshHandler()?.()}>
              <IconRefresh size={20} />
            </button>
          </Show>
        </div>
        <Outlet />
      </div>
    </DashboardProvider>
  )
}
