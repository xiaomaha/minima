import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'

type DragHandleProps = {
  onPointerDown: (e: PointerEvent) => void
  class: string
  style: JSX.CSSProperties
}

type Props = {
  children: (dragHandleProps: (index: number) => DragHandleProps) => JSX.Element
  onReorder: (from: number, to: number) => boolean
}

export const DraggableTable = (props: Props) => {
  const [dragFrom, setDragFrom] = createSignal<number | null>(null)
  const [dragOver, setDragOver] = createSignal<number | null>(null)

  onMount(() => {
    const style = document.createElement('style')
    style.textContent = '[data-draggable]{cursor:grab}'
    document.head.appendChild(style)
    onCleanup(() => document.head.removeChild(style))
  })

  const dragHandleProps = (index: number): DragHandleProps =>
    ({
      'data-draggable': true,
      onPointerDown: (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest('input, select, textarea, button, a')) return

        const tr = e.currentTarget as HTMLElement
        tr.setPointerCapture(e.pointerId)

        const startY = e.clientY
        const rect = tr.getBoundingClientRect()

        const ghost = document.createElement('table')
        ghost.className = tr.closest('table')!.className
        ghost.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          opacity: 0.8;
          pointer-events: none;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `
        const tbody = document.createElement('tbody')
        tbody.appendChild(tr.cloneNode(true))
        ghost.appendChild(tbody)
        document.body.appendChild(ghost)

        setDragFrom(index)

        const allRows = Array.from(
          tr.closest('table, [data-drag-container]')?.querySelectorAll('[data-draggable]') ?? [],
        ) as HTMLElement[]

        const onMove = (me: PointerEvent) => {
          ghost.style.top = `${rect.top + (me.clientY - startY)}px`

          let overIndex: number | null = null
          for (let i = 0; i < allRows.length; i++) {
            const r = allRows[i]?.getBoundingClientRect()
            if (!r) continue
            if (me.clientY >= r.top && me.clientY <= r.bottom) {
              overIndex = i
              break
            }
          }
          setDragOver(overIndex)
        }

        const onUp = () => {
          if (document.body.contains(ghost)) document.body.removeChild(ghost)
          tr.removeEventListener('pointermove', onMove)
          tr.removeEventListener('pointerup', onUp)
          tr.removeEventListener('pointercancel', onUp)

          const from = dragFrom()
          const to = dragOver()
          if (from !== null && to !== null && from !== to) {
            props.onReorder(from, to)
          }
          setDragFrom(null)
          setDragOver(null)
        }

        tr.addEventListener('pointermove', onMove)
        tr.addEventListener('pointerup', onUp)
        tr.addEventListener('pointercancel', onUp)
      },
      get class() {
        return [
          dragFrom() === index ? 'opacity-40' : '',
          dragOver() === index && dragFrom() !== index
            ? dragFrom()! > index
              ? 'shadow-[0_-2px_0_0_var(--color-primary)]'
              : 'shadow-[0_2px_0_0_var(--color-primary)]'
            : '',
        ].join(' ')
      },
      style: {},
    }) as unknown as DragHandleProps

  return <>{props.children(dragHandleProps)}</>
}
