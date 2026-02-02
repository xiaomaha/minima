import { createRootRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import { PLATFORM_NAME } from '@/config'
import { accountStore } from '@/routes/(app)/account/-store'
import { DateLocaleProvider } from '@/shared/DateLocaleProvider'
import { I18nProvider, useTranslation } from '@/shared/solid/i18n'
import { ToastContainer } from '@/shared/toast/ToastContainer'
import { SitePolicy } from './-SitePolicy'

const startYear = 2025
const currentYear = new Date().getFullYear()
const yearText = startYear === currentYear ? `${startYear}` : `${startYear}–${currentYear}`

const RootLayout = () => {
  const { t } = useTranslation()

  const [policyOpen, setPolicyOpen] = createSignal(false)
  const forceOpen = () => accountStore.user?.agreementRequired === true

  return (
    <>
      <div class="flex flex-col min-h-screen">
        <Outlet />
        <footer class="sticky top-[100vh] footer footer-center text-base-content/60 p-4 font-normal">
          <aside>
            <p class="flex items-center gap-2">
              {t('Copyright © {{yearText}} - All right reserved by {{PLATFORM_NAME}}.', { yearText, PLATFORM_NAME })}
              <button tabindex="-1" type="button" class="link link-hover" onClick={() => setPolicyOpen(true)}>
                {t('Site Policies')}
              </button>
            </p>
          </aside>
        </footer>
        <ToastContainer />
      </div>
      <SitePolicy open={policyOpen() || forceOpen()} setOpen={setPolicyOpen} />
    </>
  )
}

export const Route = createRootRoute({
  beforeLoad: async (context) => {
    if (accountStore.user?.agreementRequired === true) {
      if (context.location.pathname !== '/dashboard/learning') {
        throw redirect({ to: '/dashboard/learning' })
      }
    }
  },
  component: () => (
    <I18nProvider>
      <DateLocaleProvider>
        <RootLayout />
      </DateLocaleProvider>
    </I18nProvider>
  ),
})
