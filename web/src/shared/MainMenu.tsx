import { type NavigateOptions, useNavigate } from '@tanstack/solid-router'
import { For } from 'solid-js'

interface Props {
  class?: string
  active: (path: string) => boolean
  readonly menu: {
    label: string
    to: NavigateOptions['to']
  }[]
}

export const MainMenu = (props: Props) => {
  const navigate = useNavigate()

  return (
    <ul class={`menu menu-sm menu-horizontal ml-0 bg-base-200 rounded-box mb-0 space-x-2 gap-y-2 ${props.class ?? ''}`}>
      <For each={props.menu}>
        {(item) => (
          <li class="mb-0">
            <button
              type="button"
              class="min-w-16 justify-center"
              classList={{ 'menu-active': item.to ? props.active(item.to) : false }}
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
