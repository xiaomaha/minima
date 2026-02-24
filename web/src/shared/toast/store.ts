import { createSignal } from 'solid-js'

type Toast = {
  id: number
  title: string
  message: string
  duration?: number
  type: 'error' | 'success' | 'info' | 'warning'
}

const [toasts, setToasts] = createSignal<Toast[]>([])

export const showToast = (toast: Omit<Toast, 'id'>) => {
  const id = Date.now()
  setToasts((prev) => [...prev, { ...toast, id }])
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, toast.duration ?? 3000)
}

export const removeToast = (id: number) => {
  setToasts((prev) => prev.filter((t) => t.id !== id))
}

export { toasts }
