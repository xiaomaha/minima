import { createFileRoute, Outlet, useLocation } from '@tanstack/solid-router'
import { For } from 'solid-js'
import { SSO_PROVIDERS } from '@/config'
import { useTranslation } from '@/shared/solid/i18n'

export const Route = createFileRoute('/(app)/account')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const location = useLocation()

  const tabLabels: Record<string, string> = {
    profile: t('My Profile'),
    group: t('Cohort Group'),
  }

  if (SSO_PROVIDERS.length > 0) {
    tabLabels.link = t('Linked Account')
  }

  const currentTab = () => {
    const path = location().pathname.split('/').pop()
    return path
  }

  return (
    <div class="mx-auto max-w-lg py-4">
      <div class="flex items-center gap-4 justify-center">
        <ul class="menu menu-sm  menu-horizontal bg-base-200 rounded-box space-x-2 gap-y-2">
          <For each={Object.keys(tabLabels)}>
            {(tab) => (
              <li class="mb-0">
                <button
                  type="button"
                  class="min-w-16 justify-center"
                  classList={{ 'menu-active': currentTab() === tab }}
                  onClick={() => navigate({ to: `/account/${tab}` })}
                >
                  {tabLabels[tab]}
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
      <Outlet />
    </div>
  )
}
