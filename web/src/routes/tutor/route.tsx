import { createFileRoute, notFound, Outlet } from '@tanstack/solid-router'
import { NotFound } from '@/shared/error/NotFound'
import { GoToTop } from '@/shared/GoToTop'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { ThemeButton } from '@/shared/ThemeButton'
import { protectedRoute } from '../-protected'
import { LogoutButton } from '../auth/-auth/LogoutButtion'
import { useTokenExpired } from '../auth/-auth/logout'

export const Route = createFileRoute('/tutor')({
  beforeLoad: () => {
    protectedRoute()
    if (location.hostname.split('.')[0] !== 'tutor') throw notFound()
  },
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  useTokenExpired()

  return (
    <div class="flex flex-col">
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="flex-1 flex items-center">
          <NavbarLogo to="/tutor">
            <span class="text-md font-semibold">Minima Tutor</span>
          </NavbarLogo>
        </div>

        <div class="flex gap-2 md:gap-6 px-4">
          <ThemeButton />
          <LogoutButton />
        </div>
      </div>

      <main class="p-4 pb-12 mt-14 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
      <GoToTop />
    </div>
  )
}
