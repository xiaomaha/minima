import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { accountStore } from '@/routes/account/-store'
import { NotFound } from '@/shared/error/NotFound'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { ThemeButton } from '@/shared/ThemeButton'

export const Route = createFileRoute('/(auth)')({
  beforeLoad: async () => {
    if (accountStore.user) {
      throw redirect({
        to: '/',
      })
    }
  },
  component: RouteComponent,
  notFoundComponent: NotFound,
})

function RouteComponent() {
  return (
    <div class="w-full max-w-sm m-auto py-12 px-4 space-y-6">
      <div class="flex-1 flex items-center justify-center">
        <NavbarLogo>
          <span class="text-md font-semibold hidden md:block">Minima</span>
        </NavbarLogo>
      </div>
      <Outlet />

      <div class="flex justify-center mt-4">
        <ThemeButton />
      </div>
    </div>
  )
}
