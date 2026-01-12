import { type Accessor, createContext, useContext } from 'solid-js'
import type { ChatListSchema, ChatMessageSchema, ChatSchema } from '@/api'
import type { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import type { createCachedStore } from '@/shared/solid/cached-store'

type ChatListStore = ReturnType<typeof createCachedStore<ChatListSchema, { path: { id: string } }>>
type ChatMessageStore = ReturnType<typeof createCachedInfiniteStore<ChatMessageSchema, { path: { id: number } }>>

type ChatContextValue = {
  chatListStore: ChatListStore
  activeChat: Accessor<ChatSchema | undefined>
  chatMessageStore: ChatMessageStore
}

const ChatContext = createContext<ChatContextValue>()

export const ChatProvider = ChatContext.Provider

export const useChatContext = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('ChatProvider must be used within Provider')
  return ctx
}
