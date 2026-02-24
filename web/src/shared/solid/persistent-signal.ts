import { createEffect, createSignal } from 'solid-js'

export const createPersistentSignal = <T>(key: string, initialValue: T, storage: Storage = sessionStorage) => {
  const read = (): T => {
    if (typeof window === 'undefined') return initialValue
    try {
      const raw = storage.getItem(key)
      return raw === null ? initialValue : JSON.parse(raw)
    } catch {
      return initialValue
    }
  }

  const [value, setValue] = createSignal<T>(read())

  createEffect(() => {
    try {
      storage.setItem(key, JSON.stringify(value()))
    } catch {}
  })

  return [value, setValue] as const
}
