import { IconBrightnessUp, IconHazeMoon } from '@tabler/icons-solidjs'
import { createEffect } from 'solid-js'
import { createPersistentSignal } from './solid/persistent-signal'

interface Props {
  class?: string
  size?: number
}

export const ThemeButton = (props: Props) => {
  const [theme, setTheme] = createPersistentSignal<string>('theme:mode', 'light')
  const size = () => props.size || 28

  createEffect(() => {
    document.documentElement.setAttribute('data-theme', theme())
  })

  return (
    <label class={`swap swap-rotate btn btn-ghost btn-circle ${props.class ?? ''}`}>
      <input
        type="checkbox"
        class="theme-controller"
        value={theme()}
        checked={theme() === 'dark'}
        onChange={() => setTheme(theme() === 'dark' ? 'light' : 'dark')}
      />
      <IconBrightnessUp class="swap-off" size={size()} />
      <IconHazeMoon class="swap-on" size={size()} />
    </label>
  )
}
