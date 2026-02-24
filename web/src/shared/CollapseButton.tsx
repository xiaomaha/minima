import { IconChevronDown, IconChevronUp } from '@tabler/icons-solidjs'
import type { Accessor, Setter } from 'solid-js'

interface Props {
  collapsed: Accessor<boolean | undefined>
  setCollapsed: Setter<boolean | undefined>
  class?: string
  default?: boolean
}

export const CollapseButton = (props: Props) => {
  return (
    <button
      type="button"
      class={`swap swap-rotate btn btn-ghost btn-sm btn-circle outline-none ${props.class ?? ''}`}
      onClick={() => props.setCollapsed(!(props.collapsed() ?? props.default))}
      tabindex={-1}
    >
      <input type="checkbox" checked={props.collapsed() ?? props.default} readOnly tabIndex={-1} class="hidden" />
      <IconChevronDown class="swap-on" />
      <IconChevronUp class="swap-off" />
    </button>
  )
}
