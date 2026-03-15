import { createRootRoute, notFound, Outlet } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import * as v from 'valibot'
import { PLATFORM_NAME, PLATFORM_REALMS } from '@/config'
import { accountStore } from '@/routes/student/(account)/-store'
import { DateLocaleProvider } from '@/shared/DateLocaleProvider'
import { NotFound } from '@/shared/error/NotFound'
import { PreviewBanner } from '@/shared/PreviewBanner'
import { I18nProvider, useTranslation } from '@/shared/solid/i18n'
import { ToastContainer } from '@/shared/toast/ToastContainer'
import { SitePolicy } from './-SitePolicy'

const startYear = 2025
const currentYear = new Date().getFullYear()
const yearText = startYear === currentYear ? `${startYear}` : `${startYear}–${currentYear}`

const RootLayout = () => {
  const { t } = useTranslation()

  // valibot patch
  v.setSpecificMessage(v.number, () => t('Required'))

  const [policyOpen, setPolicyOpen] = createSignal(false)
  const forceOpen = () => accountStore.user?.agreementRequired === true

  const realm = window.location.hostname.split('.')[0]
  const isStudent = !PLATFORM_REALMS.includes(realm as (typeof PLATFORM_REALMS)[number])

  return (
    <div class="flex flex-col min-h-svh">
      <Outlet />
      <footer class="sticky top-[100svh] footer footer-center text-base-content/60 p-4 font-normal">
        <aside>
          <p class="flex items-center gap-4">
            {t('Copyright © {{yearText}} - All right reserved by {{PLATFORM_NAME}}.', { yearText, PLATFORM_NAME })}

            <Show when={isStudent}>
              <button tabindex="-1" type="button" class="link link-hover" onClick={() => setPolicyOpen(true)}>
                {t('Site Policies')}
              </button>
            </Show>
          </p>
        </aside>
      </footer>
      <ToastContainer />
      <Show when={isStudent}>
        <SitePolicy open={policyOpen() || forceOpen()} setOpen={setPolicyOpen} />
      </Show>
      <Show when={realm === 'preview'}>
        <PreviewBanner />
      </Show>
    </div>
  )
}

export const Route = createRootRoute({
  beforeLoad: () => {
    const realm = window.location.hostname.split('.')[0]
    const rootPath = window.location.pathname.split('/')[1]

    if (realm === rootPath) return

    if (rootPath === '') return
    if (rootPath === 'auth' && realm !== 'preview') return
    if (rootPath === 'public' && ['preview', 'student'].includes(realm as string)) return
    if (rootPath === 'student' && ['preview'].includes(realm as string)) return

    throw notFound()
  },

  notFoundComponent: NotFound,
  component: () => (
    <I18nProvider>
      <DateLocaleProvider>
        <RootLayout />
      </DateLocaleProvider>
    </I18nProvider>
  ),
})
