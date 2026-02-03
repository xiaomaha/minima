import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect, onMount, Suspense } from 'solid-js'
import * as v from 'valibot'
import { learningV1GetRecords, operationV1RegisterDevice } from '@/api'
import { getFcmToken } from '@/firebase'
import { setRecords } from '@/routes/(app)/-shared/record'
import { SearchBox } from '@/routes/(app)/-shared/SearchBox'
import { accountStore } from '@/routes/(app)/account/-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { ThemeButton } from '@/shared/ThemeButton'
import { getDeviceName } from '@/shared/utils'
import { currentDevice, setCurrentDevice } from './-device'
import { AccountButton } from './-shared/AccountButton'
import { Chat } from './-shared/aichat/Chat'
import { Notification } from './-shared/Notification'

const searchSchema = v.object({
  // program: v.optional(v.pipe(v.string())),
  course: v.optional(v.pipe(v.string())),
})

export const Route = createFileRoute('/(app)')({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    if (!accountStore.user) {
      const nextPath = location.pathname + location.search
      const shouldIgnoreNext = location.search.includes('token=')

      throw redirect({
        to: '/login',
        search: shouldIgnoreNext ? undefined : { next: nextPath },
      })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

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

  // protected route
  createEffect(() => {
    if (!accountStore.user && !location.pathname.startsWith('/login')) {
      const nextPath = location.pathname + location.search
      const shouldIgnoreNext = location.search.includes('token=')

      navigate({
        to: '/login',
        search: shouldIgnoreNext ? undefined : { next: nextPath },
      })
    }
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
    <div class="flex flex-col">
      {/* Navbar */}
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="cursor-pointer px-4 flex shrink-0" onclick={() => navigate({ to: '/dashboard' })}>
          <img src="/image/logo/logo.png" alt="Logo" class="hidden md:block w-30 h-8 in-data-[theme=dark]:hidden" />
          <img src="/image/logo/logo-dark.png" alt="Logo" class="hidden md:in-data-[theme=dark]:block w-30 h-8" />
          <img src="/image/logo/logo-square.png" alt="Logo" class="md:hidden h-8 w-auto" />
        </div>

        <SearchBox />

        <div class="flex gap-2 md:gap-6 px-4">
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
  )
}
