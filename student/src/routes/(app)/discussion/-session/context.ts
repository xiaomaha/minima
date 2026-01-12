import { createContext, useContext } from 'solid-js'
import type { DiscussionSessionSchema } from '@/api'
import type { createCachedStore } from '@/shared/solid/cached-store'

type SessionStore = ReturnType<typeof createCachedStore<DiscussionSessionSchema, { path: { id: string } }>>

const SessionContext = createContext<SessionStore>()

export const SessionProvider = SessionContext.Provider

export const useSession = () => {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within Provider')
  return ctx
}
