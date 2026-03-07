import { useWindowScrollPosition } from '@solid-primitives/scroll'
import { IconArrowUp } from '@tabler/icons-solidjs'

export const GoToTop = () => {
  const scroll = useWindowScrollPosition()
  const show = () => scroll.y > 300

  return (
    <button
      type="button"
      onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      class="btn btn-circle btn-primary fixed bottom-12 right-8 shadow-lg transition-opacity hover:opacity-100"
      classList={{ 'opacity-0': !show(), 'opacity-30': show() }}
      style={{ 'pointer-events': show() ? 'auto' : 'none' }}
    >
      <IconArrowUp size={24} />
    </button>
  )
}
