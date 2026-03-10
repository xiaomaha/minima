import { IconRefresh } from '@tabler/icons-solidjs'
import { Show } from 'solid-js'

interface Props {
  refresh: () => void
  loading: boolean
  size?: number
  class?: string
  buttonClass?: string
}

export const RefreshButton = (props: Props) => {
  return (
    <button type="button" class={`btn btn-sm btn-circle btn-ghost ${props.buttonClass}`} onClick={props.refresh}>
      <Show when={!props.loading} fallback={<span class={`loading loading-spinner loading-sm ${props.class}`} />}>
        <IconRefresh size={props.size ?? 20} />
      </Show>
    </button>
  )
}
