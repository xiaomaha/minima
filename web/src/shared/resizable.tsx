import { createEffect, createRoot, createSignal } from 'solid-js'

const { getHeightOffset } = createRoot(() => {
  const offsetMap = new Map<string, ReturnType<typeof createSignal<number>>>()

  const getHeightOffset = (id: string) => {
    if (!offsetMap.has(id)) {
      offsetMap.set(id, createSignal(0))
    }
    return offsetMap.get(id)!
  }

  return { getHeightOffset }
})

export const createResizable = (id: () => string | undefined, initialOffset = 0) => {
  const [isResizing, setIsResizing] = createSignal(false)
  const [heightOffset, setHeightOffset] = createSignal(initialOffset)

  createEffect(() => {
    const currentId = id()
    if (currentId) {
      const [storedOffset, setStoredOffset] = getHeightOffset(currentId)
      setHeightOffset(storedOffset())

      createEffect(() => {
        setStoredOffset(heightOffset())
      })
    }
  })

  const handleResize = (e: MouseEvent, maxHeight?: number) => {
    e.preventDefault()
    setIsResizing(true)
    const startY = e.clientY
    const startOffset = heightOffset()

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY
      const newOffset = startOffset + delta
      const minOffset = maxHeight ? -maxHeight * 0.7 : -999999
      const maxOffset = maxHeight ? maxHeight * 2 : 999999
      setHeightOffset(Math.max(minOffset, Math.min(maxOffset, newOffset)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const Handle = (props: { maxHeight?: number }) => (
    <div
      class="absolute -bottom-2 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 transition-colors"
      classList={{ 'bg-blue-500': isResizing() }}
      onmousedown={(e) => handleResize(e, props.maxHeight)}
    >
      <div class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-12 h-1 bg-gray-400 rounded-full" />
    </div>
  )

  return { isResizing, heightOffset, Handle, setHeightOffset }
}
