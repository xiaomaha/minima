import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { accountStore } from '@/routes/(app)/account/-store'
import { ThemeButton } from '@/shared/ThemeButton'

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
      <img src="/image/logo/logo.png" alt="Logo" class="mx-auto w-30 h-8 in-data-[theme=dark]:hidden" />
      <img src="/image/logo/logo-dark.png" alt="Logo" class="mx-auto w-30 h-8 hidden in-data-[theme=dark]:block" />
      <Outlet />

      <div class="flex justify-center mt-4">
        <ThemeButton />
      </div>
    </div>
  )
}
