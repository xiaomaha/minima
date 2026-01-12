import { useTransContext } from '@mbarzda/solid-i18next'
import { createRootRoute, Outlet } from '@tanstack/solid-router'
import { PLATFORM_NAME } from '@/config'
import { ToastContainer } from '@/shared/toast/ToastContainer'

const startYear = 2025
const currentYear = new Date().getFullYear()
const yearText = startYear === currentYear ? `${startYear}` : `${startYear}–${currentYear}`

const RootLayout = () => {
  const [t] = useTransContext()

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
  component: RootLayout,
})
