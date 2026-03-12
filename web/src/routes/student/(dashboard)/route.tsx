import { IconRefresh } from '@tabler/icons-solidjs'
import { createFileRoute, type NavigateOptions, Outlet, useLocation } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import { NotFound } from '@/shared/error/NotFound'
import { MainMenu } from '@/shared/MainMenu'
import { useTranslation } from '@/shared/solid/i18n'
import { DashboardProvider, newEnrollments } from './-context'

export const Route = createFileRoute('/student/(dashboard)')({
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  const { t } = useTranslation()
  const location = useLocation()

  const menu: { label: string; to: NavigateOptions['to'] }[] = [
    { label: t('Learning'), to: '/student/learning' },
    { label: t('Catalog'), to: '/student/catalog' },
    { label: t('Search'), to: '/student/search' },
    { label: t('goal'), to: '/student/goal' },
    { label: t('Achievement'), to: '/student/achievement' },
    { label: t('Announcement'), to: '/student/announcement' },
    { label: t('1:1 Inquiry'), to: '/student/inquiry' },
    { label: t('Report'), to: '/student/report' },
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
