import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'
import { createEffect } from 'solid-js'
import { accountStore } from '@/routes/(app)/account/-store'
import { GoToTop } from '@/shared/GoToTop'
import { MainMenu } from '@/shared/MainMenu'
import { NavbarLogo } from '@/shared/NavbarLogo'
import { useTranslation } from '@/shared/solid/i18n'
import { ThemeButton } from '@/shared/ThemeButton'
import { AccountButton } from '../(app)/-shared/AccountButton'
import { ContentSuggestionProvider } from './-context/ContentSuggestion'
import { Menu } from './-studio/Menu'

export const Route = createFileRoute('/studio')({
  beforeLoad: async () => {
    if (!accountStore.user?.roles.includes('editor')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  createEffect(() => {
    if (!accountStore.user?.roles.includes('editor') && location.pathname.startsWith('/studio')) {
      navigate({ to: '/dashboard', replace: true })
    }
  })

  const menu = [
    { label: t('Survey'), to: '/studio/survey' },
    { label: t('Quiz'), to: '/studio/quiz' },
    { label: t('Exam'), to: '/studio/exam' },
    { label: t('Assignment'), to: '/studio/assignment' },
    { label: t('Discussion'), to: '/studio/discussion' },
    { label: t('Media'), to: '/studio/media' },
    { label: t('Course'), to: '/studio/course' },
  ]

  return (
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
          }
        `}
      </style>

      <main class="p-4 mt-14">
        <ContentSuggestionProvider>
          <div class="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto my-4">
            <MainMenu menu={menu} />
            <Menu class="ml-auto" />
          </div>
          <Outlet />
        </ContentSuggestionProvider>
        <GoToTop />
      </main>
    </div>
  )
}
