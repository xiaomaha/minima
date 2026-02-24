import { IconCheck, IconCopy } from '@tabler/icons-solidjs'
import { createSignal, onCleanup, Show } from 'solid-js'

interface Props {
  onCopy: (e: MouseEvent) => void
  class?: string
}

export const CopyButton = (props: Props) => {
  const [copied, setCopied] = createSignal(false)
  let timer: ReturnType<typeof setTimeout>

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    clearTimeout(timer)
    props.onCopy(e)
    setCopied(true)
    timer = setTimeout(() => setCopied(false), 3000)
  }

  onCleanup(() => clearTimeout(timer))

  return (
    <button type="button" class={`btn btn-ghost btn-xs btn-circle ${props.class ?? ''}`} onClick={handleClick}>
      <Show when={copied()} fallback={<IconCopy size={16} />}>
        <IconCheck size={16} />
      </Show>
    </button>
  )
}
