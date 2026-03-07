import { createEffect, createRoot } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { UserSchema } from '@/api'
import i18n from '@/i18n'

interface Store {
  user: UserSchema | null | undefined
}

const STORAGE_KEY = 'account-store'

const loadInitialUser = (): UserSchema | null | undefined => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  const data = JSON.parse(stored)
  const user = data.user

  if (user?.tokenExpires && Date.now() >= new Date(user.tokenExpires).getTime()) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }

  return user
}

export const {
  store: accountStore,
  setStore,
  setUser,
  getPreferences,
  setPreferences,
  getUserLanguage,
} = createRoot(() => {
  const [store, setStore] = createStore<Store>({ user: loadInitialUser() })

  createEffect(() => {
    const { user } = store
    if (!user) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }))
    if (user.language && i18n.language !== user.language) {
      i18n.changeLanguage(user.language)
    }
    if (!user.tokenExpires) return
    const expiryTime = new Date(user.tokenExpires).getTime()
    const timeUntilExpiry = expiryTime - Date.now()
    if (timeUntilExpiry <= 0) {
      setStore('user', null)
      return
    }
    const timeout = setTimeout(() => setStore('user', null), timeUntilExpiry)
    return () => clearTimeout(timeout)
  })

  return {
    store,
    setStore,
    setUser: (user: UserSchema | null | undefined) => setStore('user', reconcile(user)),
    getPreferences: () => store.user?.preferences ?? {},
    setPreferences: (key: string, value: string | number | boolean) => {
      setStore('user', 'preferences', key, value)
    },
    getUserLanguage: () => store.user?.language ?? null,
  }
})
