import {
  createFileRoute,
  type NavigateOptions,
  notFound,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/solid-router'
import { For } from 'solid-js'
import * as v from 'valibot'
import { NotFound } from '@/shared/error/NotFound'
import { GoToTop } from '@/shared/GoToTop'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { useTranslation } from '@/shared/solid/i18n'
import { ThemeButton } from '@/shared/ThemeButton'
import { protectedRoute } from '../-protected'
import { LogoutButton } from '../auth/-auth/LogoutButtion'
import { useTokenExpired } from '../auth/-auth/logout'

const searchSchema = v.object({
  search: v.optional(v.string()),
  order: v.optional(v.string()),
  page: v.optional(v.number()),
  size: v.optional(v.number()),
})

export const Route = createFileRoute('/desk')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    protectedRoute()
    if (location.hostname.split('.')[0] !== 'desk') throw notFound()
  },
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  useTokenExpired()

  return (
    <div class="flex flex-col flex-1">
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="flex-1 flex items-center">
          <NavbarLogo to="/desk">
            <span class="text-md font-semibold">Minima Desk</span>
          </NavbarLogo>
        </div>

        <div class="flex gap-2 md:gap-6 px-4">
          <ThemeButton />
          <LogoutButton />
        </div>
      </div>

      <main class="p-4 pb-12 mt-14 max-w-460 mx-auto w-full flex-1 flex gap-8">
        <Sidebar />
        <div class="flex-1">
          <Outlet />
        </div>
      </main>
      <GoToTop />
    </div>
  )
}

type MenuItem = [title: string, to: NavigateOptions['to']]

type MenuGroupItem = [title: string, children: MenuItem[]]

const Sidebar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const data: MenuGroupItem[] = [
    [t('Account'), [[t('User'), '/desk/account/user']]],
    [
      t('Operation'),
      [
        [t('Announcement'), '/desk/operation/announcement'],
        [t('Inquiry'), '/desk/operation/inquiry'],
        [t('Appeal'), '/desk/operation/appeal'],
      ],
    ],
    [
      t('Learning'),
      [
        [t('Enrollment'), '/desk/learning/enrollment'],
        [t('Term'), '/desk/learning/term'],
        [t('Catalog'), '/desk/learning/catalog'],
      ],
    ],
    [t('Partner'), [[t('Partner'), '/desk/partner/parnter']]],
  ]

  return (
    <ul class="menu bg-base-200 rounded-box w-56 [&>li+li]:mt-2">
      <For each={data}>
        {([groupTitle, children]) => (
          <li>
            <details open>
              <summary>{groupTitle}</summary>
              <ul class="[&>li+li]:mt-1">
                <For each={children}>
                  {([appTitle, to]) => (
                    <li>
                      <button
                        classList={{ 'menu-active': to === location().pathname }}
                        type="button"
                        onClick={() => navigate({ to })}
                      >
                        {appTitle}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </details>
          </li>
        )}
      </For>
    </ul>
  )
}
