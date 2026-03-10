import { useNavigate } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'

interface Props {
  children?: JSX.Element
  class?: string
  to?: string
}

export const NavbarLogo = (props: Props) => {
  const navigate = useNavigate()

  return (
    <div
      onclick={() => navigate({ to: props.to || '/dashboard' })}
      class={`align cursor-pointer pl-4 pr-2 flex min-w-16 items-center gap-2 ${props.class || ''}`}
    >
      <img src="/image/logo/logo.png" alt="Logo" width="32" height="32" />
      {props.children}
    </div>
  )
}
