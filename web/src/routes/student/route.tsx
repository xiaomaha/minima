import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect, onMount, Suspense } from 'solid-js'
import * as v from 'valibot'
import { learningV1GetRecords, operationV1RegisterDevice } from '@/api'
import { getFcmToken } from '@/firebase'
import { setRecords } from '@/routes/student/-shared/record'
import { SearchBox } from '@/routes/student/-shared/SearchBox'
import { accountStore } from '@/routes/student/(account)/-store'
import { NotFound } from '@/shared/error/NotFound'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { createCachedStore } from '@/shared/solid/cached-store'
import { ThemeButton } from '@/shared/ThemeButton'
import { getDeviceName } from '@/shared/utils'
import { protectedRoute } from '../-protected'
import { Chat } from './-shared/aichat/Chat'
import { Notification } from './-shared/Notification'
import { AccountButton } from './(account)/-account/AccountButton'
import { currentDevice, setCurrentDevice } from './(account)/-device'

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
  )
}
