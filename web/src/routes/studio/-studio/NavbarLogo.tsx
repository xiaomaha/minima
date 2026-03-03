import { useNavigate } from '@tanstack/solid-router'

export const NavbarLogo = () => {
  const navigate = useNavigate()

  return (
    <div class="inline-flex align cursor-pointer px-4" onclick={() => navigate({ to: '/dashboard' })}>
      <img src="/image/logo/logo-studio.png" alt="Logo" class="h-8 min-w-30 md:in-data-[theme=dark]:hidden" />
      <img src="/image/logo/logo-studio-dark.png" alt="Logo" class="hidden in-data-[theme=dark]:block h-8 min-w-30" />
    </div>
  )
}
