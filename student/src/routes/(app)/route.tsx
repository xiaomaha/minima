import { IconBrightnessUp, IconHazeMoon, IconLogout, IconUser } from '@tabler/icons-solidjs'
import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect, onMount, Show, Suspense } from 'solid-js'
import * as v from 'valibot'
import { learningV1GetRecords } from '@/api'
import { setRecords } from '@/routes/(app)/-shared/record'
import { SearchBox } from '@/routes/(app)/-shared/SearchBox'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Chat } from './-shared/aichat/Chat'
import { logout } from './-shared/logout'

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
          <img src="/image/logo/logo.png" alt="Logo" class="w-30 h-8" />
        </div>

        <SearchBox />

        <div class="flex gap-6 px-4">
          <Suspense>
            <Chat />
          </Suspense>
          <button type="button" class="btn btn-ghost btn-circle">
            <label class="swap swap-rotate">
              <input type="checkbox" class="theme-controller" value="dark" />
              <IconBrightnessUp class="swap-off h-8 w-8" />
              <IconHazeMoon class="swap-on h-8 w-8" />
            </label>
          </button>

          <AccountButton />
        </div>
      </div>

      <main class="p-4 pb-12 mt-14">
        <Outlet />
      </main>
    </div>
  )
}

const AccountButton = () => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const closeDropdown = () => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur()
  }

  const handleLogout = async () => {
    closeDropdown()
    await logout()
  }

  const goToProfile = () => {
    closeDropdown()
    navigate({ to: '/account/profile' })
  }

  return (
    <Show when={accountStore.user}>
      <div class="dropdown dropdown-end">
        <Avatar user={accountStore.user!} />
        <ul
          tabindex="0"
          class="rounded-box bg-base-100 menu dropdown-content [&_li>*]:rounded-none p-1 py-2 z-1 mt-4 w-60 shadow-xl"
        >
          <li>
            <button type="button" class="btn btn-ghost justify-start gap-4 border-0 font-normal" onClick={goToProfile}>
              <IconUser />
              {t('Profile')}
            </button>
          </li>
          <li>
            <button type="button" class="btn btn-ghost justify-start gap-4 border-0 font-normal" onClick={handleLogout}>
              <IconLogout />
              {t('Logout')}
            </button>
          </li>
        </ul>
      </div>
    </Show>
  )
}
