import { IconRefresh } from '@tabler/icons-solidjs'
import { createFileRoute, Outlet, useLocation } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import { MainMenu } from '@/shared/MainMenu'
import { useTranslation } from '@/shared/solid/i18n'
import { DashboardProvider, newEnrollments } from './-context'

export const Route = createFileRoute('/(app)/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const location = useLocation()

  const menu = [
    { label: t('Learning'), to: '/dashboard/learning' },
    { label: t('Catalog'), to: '/dashboard/catalog' },
    { label: t('Search'), to: '/dashboard/search' },
    { label: t('goal'), to: '/dashboard/goal' },
    { label: t('Achievement'), to: '/dashboard/achievement' },
    { label: t('Announcement'), to: '/dashboard/announcement' },
    { label: t('1:1 Inquiry'), to: '/dashboard/inquiry' },
    { label: t('Report'), to: '/dashboard/report' },
  ]

  const [refreshHandler, setRefreshHandler] = createSignal<(() => void) | undefined>()

  return (
    <DashboardProvider value={{ newEnrollments, setRefreshHandler }}>
      <div class="mx-auto max-w-7xl p-4">
        <div class="flex items-center mb-6 gap-4">
          <MainMenu menu={menu} active={(path) => location().pathname.startsWith(path)} />
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
