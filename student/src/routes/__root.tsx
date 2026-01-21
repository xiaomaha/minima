import { createRootRoute, Outlet } from '@tanstack/solid-router'
import { PLATFORM_NAME } from '@/config'
import { DateLocaleProvider } from '@/shared/DateLocaleProvider'
import { I18nProvider, useTranslation } from '@/shared/solid/i18n'
import { ToastContainer } from '@/shared/toast/ToastContainer'

const startYear = 2025
const currentYear = new Date().getFullYear()
const yearText = startYear === currentYear ? `${startYear}` : `${startYear}–${currentYear}`

const RootLayout = () => {
  const { t } = useTranslation()
  return (
    <div class="flex flex-col min-h-screen">
      <Outlet />
      <footer class="sticky top-[100vh] footer footer-center text-base-content/60 p-4">
        <aside>
          <p>{t('Copyright © {{yearText}} - All right reserved by {{PLATFORM_NAME}}.', { yearText, PLATFORM_NAME })}</p>
        </aside>
      </footer>
      <ToastContainer />
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <I18nProvider>
      <DateLocaleProvider>
        <RootLayout />
      </DateLocaleProvider>
    </I18nProvider>
  ),
})
