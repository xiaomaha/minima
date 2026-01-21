import { IconAi, IconQuestionMark } from '@tabler/icons-solidjs'
import { createSignal, Show, Suspense } from 'solid-js'
import { Portal } from 'solid-js/web'
import { assistantV1GetChatMessages, assistantV1GetChats } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { ResizableWindow } from '@/shared/ResizableWindow'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { ChatProvider } from './context'
import { MessageEditor } from './MessageEditor'
import { MessageList } from './MessageList'

export const Chat = () => {
  const { t } = useTranslation()
  const [open, setOpen] = createSignal(false)

  const chatListStore = createCachedStore(
    'assistantV1GetChats',
    () => (open() ? {} : undefined),
    async (options) => {
      const { data } = await assistantV1GetChats(options)
      return data
    },
  )

  const activeChat = () => chatListStore[0].data?.chats.find((chat) => chat.active)

  const chatMessageStore = createCachedInfiniteStore(
    'assistantV1GetChatMessages',
    () => (activeChat() ? { path: { id: activeChat()!.id } } : undefined),
    async (options, page) => {
      const { data } = await assistantV1GetChatMessages({ ...options, query: { page } })
      return data
    },
  )

  return (
    <>
      <button type="button" class="btn btn-ghost btn-circle relative" onClick={() => setOpen(!open())}>
        <div class="status status-info absolute top-0.5 right-0.5" />
        <IconAi class="h-10 w-10" />
      </button>

      <Show when={open()}>
        <ChatProvider value={{ chatListStore, activeChat, chatMessageStore }}>
          <Portal>
            <ResizableWindow
              class="bg-base-100 rounded-lg shadow-2xl border border-base-300 flex flex-col"
              onClose={() => setOpen(false)}
              title={activeChat()?.title || t('New Chat')}
            >
              <div class="flex flex-col h-full">
                <Suspense fallback={<LoadingOverlay class="static" />}>
                  <Show
                    when={activeChat()}
                    fallback={
                      <div class="inset-0 m-auto">
                        <IconQuestionMark size={48} class="mx-auto mb-4" />
                        {t('Ask a question to the assistant.')}
                      </div>
                    }
                  >
                    <MessageList />
                  </Show>
                </Suspense>

                <div class="p-4 shrink-0">
                  <MessageEditor />
                </div>
              </div>
            </ResizableWindow>
          </Portal>
        </ChatProvider>
      </Show>
    </>
  )
}
