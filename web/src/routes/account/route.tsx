import { createFileRoute, type NavigateOptions, Outlet, useLocation } from '@tanstack/solid-router'
import { SSO_PROVIDERS } from '@/config'
import { NotFound } from '@/shared/error/NotFound'
import { MainMenu } from '@/shared/MainMenu'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { useTranslation } from '@/shared/solid/i18n'
import { ThemeButton } from '@/shared/ThemeButton'
import { protectedRoute } from '../-protected'
import { AccountButton } from './-account/AccountButton'

export const Route = createFileRoute('/account')({
  beforeLoad: protectedRoute,
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  const { t } = useTranslation()
  const location = useLocation()

  const tabs = () => {
    const result: { label: string; to: NavigateOptions['to'] }[] = [
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
    <div class="flex flex-col">
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="flex-1 flex items-center">
          <NavbarLogo>
            <span class="text-md font-semibold hidden md:block">Minima</span>
          </NavbarLogo>
        </div>

        <div class="flex gap-2 md:gap-6 px-4">
          <ThemeButton />
          <AccountButton />
        </div>
      </div>

      <div class="mx-auto max-w-lg py-4 mt-14 w-full">
        <div class="flex items-center gap-4 justify-center mb-8">
          <MainMenu menu={tabs()} active={(path) => location().pathname.startsWith(path)} />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
