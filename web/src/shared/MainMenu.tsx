import { useLocation, useNavigate } from '@tanstack/solid-router'
import { For } from 'solid-js'

interface Props {
  class?: string
  readonly menu: {
    label: string
    to: string
  }[]
}

export const MainMenu = (props: Props) => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <ul class={`menu menu-sm menu-horizontal ml-0 bg-base-200 rounded-box mb-0 space-x-2 gap-y-2 ${props.class ?? ''}`}>
      <For each={props.menu}>
        {(item) => (
          <li class="mb-0">
            <button
              type="button"
              class="min-w-16 justify-center"
              classList={{ 'menu-active': location().pathname.startsWith(item.to) }}
              onClick={() => navigate({ to: item.to })}
            >
              {item.label}
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
