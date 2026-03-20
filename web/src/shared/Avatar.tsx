import { Show } from 'solid-js'

interface Props {
  user: {
    avatar: string | null
    name: string
    nickname?: string
  }
  size?: 'sm' | 'md' | 'lg' | '3xl'
  class?: string
  rounded?: boolean
}

const SIZE_CONFIG = {
  sm: { container: 'w-8', text: 'text-sm' },
  md: { container: 'w-10', text: 'text-base' },
  lg: { container: 'w-14', text: 'text-2xl' },
  '3xl': { container: 'w-32', text: 'text-6xl' },
}

export const Avatar = (props: Props) => {
  const avatar = () => props.user.avatar
  const displayName = () => props.user.nickname || props.user.name
  const config = () => SIZE_CONFIG[props.size || 'md']

  return (
    <div
      class={`select-none avatar avatar-placeholder capitalize cursor-pointer ${props.class ?? ''}`}
      title={displayName()}
    >
      <div
        class={`${config().container} mask mask-squircle bg-base-content/10`}
        classList={{ 'rounded-full': props.rounded, 'mask mask-squircle': props.rounded }}
      >
        <Show when={avatar()} fallback={<span class={config().text}>{displayName()[0]}</span>}>
          <img src={avatar()!} alt={displayName()} />
        </Show>
      </div>
    </div>
  )
}
