import { useNavigate } from '@tanstack/solid-router'

export const NavbarLogo = () => {
  const navigate = useNavigate()

  return (
    <div class="inline-flex align cursor-pointer pl-4 pr-2" onclick={() => navigate({ to: '/dashboard' })}>
      <img src="/image/logo/logo.png" alt="Logo" width="32" height="32" />
    </div>
  )
}
