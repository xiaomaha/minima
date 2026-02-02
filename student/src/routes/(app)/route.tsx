import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect, onMount, Suspense } from 'solid-js'
import * as v from 'valibot'
import { learningV1GetRecords } from '@/api'
import { setRecords } from '@/routes/(app)/-shared/record'
import { SearchBox } from '@/routes/(app)/-shared/SearchBox'
import { accountStore } from '@/routes/(app)/account/-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { ThemeButton } from '@/shared/ThemeButton'
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

  return (
    <div class="flex flex-col">
      {/* Navbar */}
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="cursor-pointer px-4 flex shrink-0" onclick={() => navigate({ to: '/dashboard' })}>
          <img src="/image/logo/logo.png" alt="Logo" class="w-30 h-8 in-data-[theme=dark]:hidden" />
          <img src="/image/logo/logo-dark.png" alt="Logo" class="w-30 h-8 hidden in-data-[theme=dark]:block" />
        </div>

        <SearchBox />

        <div class="flex gap-6 px-4">
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
