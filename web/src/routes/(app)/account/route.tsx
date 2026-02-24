import { createFileRoute, Outlet } from '@tanstack/solid-router'
import { SSO_PROVIDERS } from '@/config'
import { MainMenu } from '@/shared/MainMenu'
import { useTranslation } from '@/shared/solid/i18n'

export const Route = createFileRoute('/(app)/account')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()

  const tabs = () => {
    const result = [
      { label: t('My Profile'), to: '/account/profile' },
      { label: t('Notification Devices'), to: '/account/device' },
      { label: t('Cohort Group'), to: '/account/group' },
    ]

    if (SSO_PROVIDERS.length > 0) {
      result.splice(1, 0, { label: t('Linked Account'), to: '/account/link' })
    }

    return result
  }

  return (
    <div class="mx-auto max-w-lg py-4">
      <div class="flex items-center gap-4 justify-center mb-8">
        <MainMenu menu={tabs()} />
      </div>
      <Outlet />
    </div>
  )
}
