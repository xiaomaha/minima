import { createFileRoute, Outlet, useLocation } from '@tanstack/solid-router'
import { For } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { NewEnrollmentProvider } from './-context'

export const Route = createFileRoute('/(app)/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const location = useLocation()

  const tabLabels: Record<string, string> = {
    learning: t('Learning'),
    search: t('Search'),
    catalog: t('Catalog'),
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

  return (
    <NewEnrollmentProvider value={[]}>
      <div class="mx-auto max-w-7xl p-4">
        <ul class="menu menu-sm  menu-horizontal bg-base-200 rounded-box mb-6 space-x-2 gap-y-2">
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
        <Outlet />
      </div>
    </NewEnrollmentProvider>
  )
}
