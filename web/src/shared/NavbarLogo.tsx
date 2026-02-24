import { useNavigate } from '@tanstack/solid-router'

export const NavbarLogo = () => {
  const navigate = useNavigate()

  return (
    <div class="inline-flex align cursor-pointer px-4" onclick={() => navigate({ to: '/dashboard' })}>
      <img src="/image/logo/logo.png" alt="Logo" class="hidden md:block h-8 min-w-30 md:in-data-[theme=dark]:hidden" />
      <img src="/image/logo/logo-dark.png" alt="Logo" class="hidden md:in-data-[theme=dark]:block h-8 min-w-30" />
      <img src="/image/logo/logo-square.png" alt="Logo" class="md:hidden h-8 min-w-10.5" />
    </div>
  )
}
