import { IconBrightnessUp, IconHazeMoon } from '@tabler/icons-solidjs'
import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { store as accountStore } from '@/routes/(app)/account/-store'

export const Route = createFileRoute('/(auth)')({
  beforeLoad: async () => {
    if (accountStore.user) {
      throw redirect({
        to: '/dashboard',
      })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="w-full max-w-sm m-auto py-12 px-4 space-y-6">
      <img src="/image/logo/logo.png" alt="Logo" class="h-8 w-auto mx-auto" />
      <Outlet />
      <div class="flex justify-center">
        <label class="swap swap-rotate">
          <input type="checkbox" class="theme-controller" value="dark" />
          <IconBrightnessUp class="swap-off" />
          <IconHazeMoon class="swap-on" />
        </label>
      </div>
    </div>
  )
}
