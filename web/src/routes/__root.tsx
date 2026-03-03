import { IconHelpCircle } from '@tabler/icons-solidjs'
import { createRootRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import * as v from 'valibot'
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

  // valibot patch
  v.setSpecificMessage(v.number, () => t('required'))

  const [policyOpen, setPolicyOpen] = createSignal(false)
  const forceOpen = () => accountStore.user?.agreementRequired === true

  return (
    <>
      <div class="flex flex-col min-h-svh">
        <Outlet />
        <footer class="sticky top-[100svh] footer footer-center text-base-content/60 p-4 font-normal">
          <aside>
            <p class="flex items-center gap-4">
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

const searchSchema = v.object({
  mode: v.optional(v.picklist(['preview', 'audit'])),
})

export const Route = createRootRoute({
  validateSearch: searchSchema,
  beforeLoad: async (context) => {
    if (accountStore.user?.agreementRequired === true) {
      if (context.location.pathname !== '/dashboard/learning') {
        throw redirect({ to: '/dashboard/learning' })
      }
    }
  },
  component: () => {
    const search = Route.useSearch()

    return (
      <I18nProvider>
        <DateLocaleProvider>
          <RootLayout />
        </DateLocaleProvider>
        <PreviewBanner mode={search().mode} />
      </I18nProvider>
    )
  },
})

const PreviewBanner = (props: { mode: 'preview' | 'audit' | undefined; class?: string }) => {
  const { t } = useTranslation()

  return (
    <Show when={props.mode === 'preview'}>
      <div role="alert" class={`alert alert-warning bg-warning/60 fixed bottom-8 left-8 z-1000 ${props.class}`}>
        <span class="font-semibold">{t('Preview mode')}</span>
        <span class="tooltip">
          <div class="tooltip-content text-left">
            <span class="text-left">
              {t('You can use all features without any restrictions. Data will be deleted in about an hour.')}
            </span>
          </div>
          <IconHelpCircle size={20} />
        </span>
      </div>
    </Show>
  )
}
