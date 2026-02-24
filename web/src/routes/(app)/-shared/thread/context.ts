import { createContext, useContext } from 'solid-js'
import type { CommentNestedSchema, ThreadSchema } from '@/api'
import type { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import type { createCachedStore } from '@/shared/solid/cached-store'

type ThreadStore = ReturnType<
  typeof createCachedStore<ThreadSchema, { path: { appLabel: string; model: string; subjectId: string | number } }>
>
type CommentStore = ReturnType<
  typeof createCachedInfiniteStore<CommentNestedSchema, { path: { id: number }; query: { page: number } }>
>

export type ThreadContextValue = {
  threadStore: ThreadStore
  commentStore: CommentStore
  context: {
    appLabel: string
    model: string
    subjectId: string
    title?: string
    description?: string
    options?: {
      readOnly?: boolean
      rating?: boolean
      reply?: boolean
      richText?: boolean
      editorClass?: string
    }
  }
}

const ThreadContext = createContext<ThreadContextValue>()

export const ThreadProvider = ThreadContext.Provider

export const useThreadContext = () => {
  const ctx = useContext(ThreadContext)
  if (!ctx) throw new Error('ThreadProvider must be used within Provider')
  return ctx
}
