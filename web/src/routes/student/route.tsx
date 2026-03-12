import { IconHelpCircle } from '@tabler/icons-solidjs'
import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect, onMount, Show, Suspense } from 'solid-js'
import * as v from 'valibot'
import { learningV1GetRecords, operationV1RegisterDevice } from '@/api'
import { getFcmToken } from '@/firebase'
import { accountStore } from '@/routes/account/-store'
import { setRecords } from '@/routes/student/-shared/record'
import { SearchBox } from '@/routes/student/-shared/SearchBox'
import { NotFound } from '@/shared/error/NotFound'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { ThemeButton } from '@/shared/ThemeButton'
import { capitalize, getDeviceName } from '@/shared/utils'
import { protectedRoute } from '../-protected'
import { AccountButton } from '../account/-account/AccountButton'
import { currentDevice, setCurrentDevice } from '../account/-device'
import { Chat } from './-shared/aichat/Chat'
import { Notification } from './-shared/Notification'

const searchSchema = v.object({
  course: v.optional(v.pipe(v.string())),
})

export const Route = createFileRoute('/student')({
  validateSearch: searchSchema,
  beforeLoad: async (context) => {
    protectedRoute()

    if (accountStore.user?.agreementRequired === true) {
      if (context.location.pathname !== '/student/learning') {
        throw redirect({ to: '/student/learning' })
      }
    }
  },
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  // local database
  onMount(async () => {
    createCachedStore(
      'learningV1GetRecords',
      () => ({}),
      async (options) => {
        const { data } = await learningV1GetRecords(options)
        setRecords(data)
        return data
      },
    )
  })

  createEffect(async () => {
    if (currentDevice()) return

    const user = accountStore.user
    if (!user || user.agreementRequired) return

    const permission =
      window.Notification.permission === 'granted' ? 'granted' : await window.Notification.requestPermission()
    if (permission !== 'granted') return

    const token = await getFcmToken()
    if (!token) return

    const { data } = await operationV1RegisterDevice({
      body: { token, platform: 'web', deviceName: getDeviceName() },
    })

    setCurrentDevice(data)
  })

  return (
    <>
      <div class="flex flex-col">
        <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
          <div class="flex-1 flex items-center">
            <NavbarLogo>
              <span class="text-md font-semibold hidden md:block">Minima</span>
            </NavbarLogo>
          </div>

          <SearchBox />

          <div class="flex-1 flex gap-2 md:gap-6 px-4 justify-end">
            <Suspense>
              <Chat />
            </Suspense>

            <ThemeButton />

            <Notification />

            <AccountButton />
          </div>
        </div>

        <main class="p-4 pb-12 mt-14">
          <Outlet />
        </main>
      </div>
      <AuditBanner />
    </>
  )
}

const AuditBanner = () => {
  const { t } = useTranslation()

  const subdomain = () => location.hostname.split('.')[0]
  const isAuditMode = () => subdomain() !== 'student'

  return (
    <Show when={isAuditMode()}>
      <div role="alert" class="alert alert-warning bg-warning/60 fixed bottom-8 left-8 z-1000">
        <span class="font-semibold">{t('{{realm}} preview', { realm: t(capitalize(subdomain()!)) })}</span>
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
