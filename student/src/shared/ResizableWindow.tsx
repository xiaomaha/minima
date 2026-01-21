import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { WindowButton } from './WindowButtion'

type ResizableWindowProps = {
  children: JSX.Element
  title?: string | JSX.Element
  fullscreen?: boolean
  class?: string
  defaultWidth?: number
  defaultHeight?: number
  marginRight?: number
  marginBottom?: number
  minWidth?: number
  minHeight?: number
  onClose: () => void
}

let savedWindowState: { width: number; height: number; x: number; y: number } | null = null

export const ResizableWindow = (props: ResizableWindowProps) => {
  const { t } = useTranslation()
  const defaultWidth = props.defaultWidth ?? 450
  const defaultHeight = props.defaultHeight ?? 700
  const marginRight = props.marginRight ?? 16
  const marginBottom = props.marginBottom ?? 16

  const getConstraints = () => ({
    maxWidth: window.innerWidth - marginRight,
    maxHeight: window.innerHeight - marginBottom,
  })

  const constraints = getConstraints()
  const initialWidth = Math.min(defaultWidth, constraints.maxWidth)
  const initialHeight = Math.min(defaultHeight, constraints.maxHeight)

  const initialState = savedWindowState ?? {
    width: initialWidth,
    height: initialHeight,
    x: Math.max(0, window.innerWidth - initialWidth - marginRight),
    y: Math.max(0, window.innerHeight - initialHeight - marginBottom),
  }

  const [width, setWidth] = createSignal(initialState.width)
  const [height, setHeight] = createSignal(initialState.height)
  const [x, setX] = createSignal(initialState.x)
  const [y, setY] = createSignal(initialState.y)
  const [isDragging, setIsDragging] = createSignal(false)
  const [isResizing, setIsResizing] = createSignal(false)
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 640)
  const [isFullscreen, setIsFullscreen] = createSignal(window.innerWidth < 640 || props.fullscreen)

  let containerRef: HTMLDivElement | undefined
  let lastFrameTime = 0
  const throttleMs = 16

  const updateSavedState = () => {
    savedWindowState = {
      width: width(),
      height: height(),
      x: x(),
      y: y(),
    }
  }

  const clampPosition = (newX: number, newY: number, w: number, h: number) => {
    const clampedX = Math.max(0, Math.min(window.innerWidth - w, newX))
    const clampedY = Math.max(0, Math.min(window.innerHeight - h, newY))
    return { x: clampedX, y: clampedY }
  }

  const handleResize = () => {
    const wasMobile = isMobile()
    const nowMobile = window.innerWidth < 640
    setIsMobile(nowMobile)

    if (!wasMobile && nowMobile) {
      setIsFullscreen(true)
    }

    if (!isFullscreen()) {
      const clamped = clampPosition(x(), y(), width(), height())
      setX(clamped.x)
      setY(clamped.y)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose()
    }
    if (e.key === 'Tab') {
      if (!containerRef) return

      const focusableElements = containerRef.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }
  }

  onMount(() => {
    window.addEventListener('resize', handleResize)
    document.addEventListener('keydown', handleKeyDown)

    const firstFocusable = containerRef?.querySelector('button') as HTMLElement
    firstFocusable?.focus()
  })

  onCleanup(() => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('keydown', handleKeyDown)
  })

  const handleDragStart = (e: MouseEvent | TouchEvent) => {
    if (isFullscreen()) return
    e.preventDefault()
    setIsDragging(true)

    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    const startMouseX = clientX ?? 0
    const startMouseY = clientY ?? 0
    const startX = x()
    const startY = y()

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const now = performance.now()
      if (now - lastFrameTime < throttleMs) return
      lastFrameTime = now

      const moveX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
      const moveY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY
      const newX = startX + moveX - startMouseX
      const newY = startY + moveY - startMouseY
      const clamped = clampPosition(newX, newY, width(), height())
      setX(clamped.x)
      setY(clamped.y)
    }

    const handleEnd = () => {
      setIsDragging(false)
      updateSavedState()
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }

  const handleResizeStart = (
    e: MouseEvent | TouchEvent,
    direction: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r',
  ) => {
    if (isFullscreen()) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)

    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    const startX = clientX ?? 0
    const startY = clientY ?? 0
    const startWidth = width()
    const startHeight = height()
    const startPosX = x()
    const startPosY = y()
    const minW = props.minWidth ?? 350
    const minH = props.minHeight ?? 400
    const maxW = window.innerWidth
    const maxH = window.innerHeight

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const now = performance.now()
      if (now - lastFrameTime < throttleMs) return
      lastFrameTime = now

      const moveX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
      const moveY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY
      const deltaX = moveX - startX
      const deltaY = moveY - startY

      if (direction === 'br') {
        const newWidth = Math.max(minW, Math.min(maxW - startPosX, startWidth + deltaX))
        const newHeight = Math.max(minH, Math.min(maxH - startPosY, startHeight + deltaY))
        setWidth(newWidth)
        setHeight(newHeight)
      } else if (direction === 'bl') {
        const newWidth = Math.max(minW, Math.min(startPosX + startWidth, startWidth - deltaX))
        const newHeight = Math.max(minH, Math.min(maxH - startPosY, startHeight + deltaY))
        setWidth(newWidth)
        setX(startPosX + (startWidth - newWidth))
        setHeight(newHeight)
      } else if (direction === 'tr') {
        const newWidth = Math.max(minW, Math.min(maxW - startPosX, startWidth + deltaX))
        const newHeight = Math.max(minH, Math.min(startPosY + startHeight, startHeight - deltaY))
        setWidth(newWidth)
        setHeight(newHeight)
        setY(startPosY + (startHeight - newHeight))
      } else if (direction === 'tl') {
        const newWidth = Math.max(minW, Math.min(startPosX + startWidth, startWidth - deltaX))
        const newHeight = Math.max(minH, Math.min(startPosY + startHeight, startHeight - deltaY))
        setWidth(newWidth)
        setHeight(newHeight)
        setX(startPosX + (startWidth - newWidth))
        setY(startPosY + (startHeight - newHeight))
      } else if (direction === 't') {
        const newHeight = Math.max(minH, Math.min(startPosY + startHeight, startHeight - deltaY))
        setHeight(newHeight)
        setY(startPosY + (startHeight - newHeight))
      } else if (direction === 'b') {
        const newHeight = Math.max(minH, Math.min(maxH - startPosY, startHeight + deltaY))
        setHeight(newHeight)
      } else if (direction === 'l') {
        const newWidth = Math.max(minW, Math.min(startPosX + startWidth, startWidth - deltaX))
        setWidth(newWidth)
        setX(startPosX + (startWidth - newWidth))
      } else if (direction === 'r') {
        const newWidth = Math.max(minW, Math.min(maxW - startPosX, startWidth + deltaX))
        setWidth(newWidth)
      }
    }

    const handleEnd = () => {
      setIsResizing(false)
      updateSavedState()
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }

  return (
    <div
      ref={containerRef}
      class={`fixed flex flex-col ${!isFullscreen() && isMobile() ? 'mx-auto left-0 right-0' : ''} ${props.class ?? ''}`}
      style={{
        ...(isFullscreen() && {
          position: 'fixed',
          left: '0',
          right: '0',
          top: '0',
          bottom: '0',
          width: '100%',
          height: '100%',
          margin: '0',
          'border-radius': '0',
          border: 'none',
          'box-shadow': 'none',
        }),
        ...(!isFullscreen() &&
          !isMobile() && {
            left: `${x()}px`,
            top: `${y()}px`,
            width: `${width()}px`,
            height: `${height()}px`,
          }),
        ...(!isFullscreen() &&
          isMobile() && {
            top: `${y()}px`,
            width: `${width()}px`,
            height: `${height()}px`,
          }),
        'z-index': '9999',
        'user-select': isDragging() || isResizing() ? 'none' : 'auto',
      }}
      role="dialog"
    >
      <div
        class="flex text-base-content/50 gap-2 p-4 shrink-0 h-12"
        classList={{ 'cursor-move': !isFullscreen() }}
        onmousedown={handleDragStart}
        ontouchstart={handleDragStart}
      >
        <WindowButton title={t('Close')} colorClass="text-rose-500" onClick={props.onClose} />
        <WindowButton
          title={t('Fullscreen')}
          colorClass="text-green-500"
          onClick={() => setIsFullscreen(!isFullscreen())}
        />

        <Show when={props.title}>
          <div class="flex-1 ml-2 text-sm line-clamp-1">{props.title}</div>
        </Show>
      </div>

      <div
        class="flex-1 overflow-auto"
        style={{
          'overscroll-behavior': 'contain',
          'min-height': '0',
        }}
      >
        {props.children}
      </div>

      {!isFullscreen() && (
        <>
          <div
            class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'tl')}
            ontouchstart={(e) => handleResizeStart(e, 'tl')}
          />
          <div
            class="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'tr')}
            ontouchstart={(e) => handleResizeStart(e, 'tr')}
          />
          <div
            class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'bl')}
            ontouchstart={(e) => handleResizeStart(e, 'bl')}
          />
          <div
            class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'br')}
            ontouchstart={(e) => handleResizeStart(e, 'br')}
          />

          <div
            class="absolute top-0 left-4 right-4 h-1 cursor-n-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 't')}
            ontouchstart={(e) => handleResizeStart(e, 't')}
          />
          <div
            class="absolute bottom-0 left-4 right-4 h-1 cursor-s-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'b')}
            ontouchstart={(e) => handleResizeStart(e, 'b')}
          />
          <div
            class="absolute left-0 top-4 bottom-4 w-1 cursor-w-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'l')}
            ontouchstart={(e) => handleResizeStart(e, 'l')}
          />
          <div
            class="absolute right-0 top-4 bottom-4 w-1 cursor-e-resize z-10"
            onmousedown={(e) => handleResizeStart(e, 'r')}
            ontouchstart={(e) => handleResizeStart(e, 'r')}
          />
        </>
      )}
    </div>
  )
}
