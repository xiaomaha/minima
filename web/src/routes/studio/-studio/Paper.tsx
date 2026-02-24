import { createEffect, createSignal, type JSX, onMount, Show } from 'solid-js'
import { CollapseButton } from '@/shared/CollapseButton'
import { useCollapse } from '../-context/CollapseContext'

interface Props {
  class?: string
  children: JSX.Element
  fallback: JSX.Element
  collapsed?: boolean
}

export const Paper = (props: Props) => {
  const [collapsed, setCollapsed] = createSignal(props.collapsed)

  const forceCollapse = useCollapse()

  createEffect(() => {
    if (forceCollapse?.collapsed() === undefined) return
    setCollapsed(forceCollapse.collapsed())
  })

  onMount(() => {
    if (props.collapsed === false) {
      setCollapsed(false)
    }
  })

  return (
    <div
      data-paper
      class={`flex-1 space-y-8 min-h-12 relative bg-base-100 rounded-lg p-12 ${collapsed() ? 'py-2' : ''} ${props.class ?? ''}`}
      tabindex={-1}
    >
      <CollapseButton
        class="absolute left-4 opacity-30 hover:opacity-100 top-2"
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <Show
        when={!collapsed()}
        fallback={
          <div
            class="inset-0 absolute cursor-pointer m-0 pl-16 flex items-center gap-4 px-4"
            onclick={() => setCollapsed(false)}
            tabIndex={-1}
          >
            {props.fallback}
          </div>
        }
      >
        {props.children}
      </Show>
    </div>
  )
}
