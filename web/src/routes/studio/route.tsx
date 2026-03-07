import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect } from 'solid-js'
import { accountStore } from '@/routes/(app)/account/-store'
import { GoToTop } from '@/shared/GoToTop'
import { ThemeButton } from '@/shared/ThemeButton'
import { AccountButton } from '../(app)/-shared/AccountButton'
import { NavbarLogo } from './-studio/NavbarLogo'

export const Route = createFileRoute('/studio')({
  beforeLoad: async () => {
    if (!accountStore.user?.roles.includes('editor')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  createEffect(() => {
    if (!accountStore.user?.roles.includes('editor')) {
      navigate({ to: '/dashboard', replace: true })
    }
  })

  return (
    <>
      <style>
        {`
          html {
            background-color: var(--color-base-300);
            background-image: repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 13px,
              color-mix(in oklch, var(--color-base-content), transparent 97%) 13px,
              color-mix(in oklch, var(--color-base-content), transparent 97%) 14px
            );
            background-attachment: fixed;
          }
        `}
      </style>
      <div class="flex flex-col">
        <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
          <div class="flex-1 flex items-center">
            <NavbarLogo />
          </div>

          <div class="flex gap-2 md:gap-6 px-4">
            <ThemeButton />
            <AccountButton />
          </div>
        </div>

        <main class="p-4 pb-12 mt-14 max-w-5xl mx-auto w-full">
          <Outlet />
          <GoToTop />
        </main>
      </div>
    </>
  )
}
