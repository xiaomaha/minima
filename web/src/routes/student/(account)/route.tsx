import { createFileRoute, type NavigateOptions, Outlet, useLocation } from '@tanstack/solid-router'
import { SSO_PROVIDERS } from '@/config'
import { NotFound } from '@/shared/error/NotFound'
import { MainMenu } from '@/shared/MainMenu'
import { useTranslation } from '@/shared/solid/i18n'
import { protectedRoute } from '../../-protected'

export const Route = createFileRoute('/student/(account)')({
  beforeLoad: protectedRoute,
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  const { t } = useTranslation()
  const location = useLocation()

  const tabs = () => {
    const result: { label: string; to: NavigateOptions['to'] }[] = [
      { label: t('My Profile'), to: '/student/profile' },
      { label: t('Notification Devices'), to: '/student/device' },
      { label: t('Cohort Group'), to: '/student/group' },
    ]

    if (SSO_PROVIDERS.length > 0) {
      result.splice(1, 0, { label: t('Linked Account'), to: '/student/link' })
    }

    return result
  }

  return (
    <div class="flex flex-col">
      <div class="mx-auto max-w-lg p-4 w-full">
        <div class="flex items-center gap-4 justify-center mb-8">
          <MainMenu menu={tabs()} active={(path) => location().pathname.startsWith(path)} />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
