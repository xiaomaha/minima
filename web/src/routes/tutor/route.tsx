import { createFileRoute, Outlet } from '@tanstack/solid-router'
import { tutorV1GetAllocation } from '@/api'
import { GoToTop } from '@/shared/GoToTop'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { ThemeButton } from '@/shared/ThemeButton'
import { AccountButton } from '../(app)/-shared/AccountButton'
import { protectedRoute } from '../protected'
import { AllocationProvider } from './-context'

export const Route = createFileRoute('/tutor')({
  beforeLoad: protectedRoute,
  component: RouteComponent,
})

function RouteComponent() {
  const allocations = createCachedInfiniteStore(
    'tutorV1GetAllocation',
    () => ({}),
    async (_, page) => (await tutorV1GetAllocation({ query: { page } })).data,
  )

  return (
    <div class="flex flex-col">
      <div class="justify-between navbar bg-base-100/90 w-full min-h-14 fixed top-0 z-10 backdrop-blur-2xl">
        <div class="flex-1 flex items-center">
          <NavbarLogo />
          <span class="text-md font-semibold">Minima Tutor</span>
        </div>

        <div class="flex gap-2 md:gap-6 px-4">
          <ThemeButton />
          <AccountButton />
        </div>
      </div>

      <main class="p-4 pb-12 mt-14 max-w-6xl mx-auto w-full">
        <AllocationProvider value={allocations}>
          <Outlet />
        </AllocationProvider>
      </main>
      <GoToTop />
    </div>
  )
}
