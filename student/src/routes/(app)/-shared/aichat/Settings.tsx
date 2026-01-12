import { useTransContext } from '@mbarzda/solid-i18next'
import { IconTrash } from '@tabler/icons-solidjs'
import { For, Show } from 'solid-js'
import { assistantV1DeleteChat, assistantV1SaveAssistantNote, type ChatSchema } from '@/api'
import { WindowButton } from '@/shared/WindowButtion'
import { useChatContext } from './context'

export const Settings = () => {
  const [t] = useTransContext()

  const [chatList, { setStore: setChatList }] = useChatContext().chatListStore

  let dropdownRef: HTMLUListElement | undefined

  const selectChat = (chat: ChatSchema) => {
    setChatList('data', 'chats', (c) => c.active, 'active', false)
    setChatList('data', 'chats', (c) => c.id === chat.id, 'active', true)
    dropdownRef?.hidePopover()
  }

  const deleteChat = async (chat: ChatSchema, e: Event) => {
    e.stopPropagation()
    if (!confirm(t('Are you sure you want to delete this chat?'))) return
    await assistantV1DeleteChat({ path: { id: chat.id } })
    setChatList('data', 'chats', (prev) => prev.filter((c) => c.id !== chat.id))
    if (chatList.data?.chats.length === 0) {
      dropdownRef?.hidePopover()
    }
  }

  const saveNote = async (e: FocusEvent) => {
    const value = (e.currentTarget as HTMLTextAreaElement).value.trim()
    if (!value || value === chatList.data?.assistantNote) return
    await assistantV1SaveAssistantNote({ body: { note: value } })
    setChatList('data', 'assistantNote', value)
  }

  return (
    <ul
      ref={dropdownRef}
      popover
      id="popover-1"
      style="position-anchor:--anchor-1"
      class="menu dropdown dropdown-top dropdown-end max-w-110 w-full rounded-box bg-base-100 p-4 border border-base-300 shadow-lg"
    >
      <WindowButton
        title={t('Close')}
        colorClass="text-red-500"
        onClick={() => dropdownRef?.hidePopover()}
        class="absolute left-2 top-2"
      />

      <li class="text-xs label m-3">{t('Recent Chats')}</li>
      <For
        each={chatList.data?.chats}
        fallback={<div class="text-center text-sm opacity-50 py-4">{t('No chats yet')}</div>}
      >
        {(chat) => (
          <li
            classList={{
              'bg-base-content/5': chat.id === chatList.data?.chats.find((c) => c.active)?.id,
            }}
            onclick={() => selectChat(chat)}
          >
            <div class="flex items-center w-full gap-4">
              <div class="flex-1">
                <Show when={chat.lastMessage}>
                  <time class="label text-xs">{new Date(chat.lastMessage!).toLocaleString()}</time>
                </Show>
                <div class="line-clamp-1 text-sm">{chat.title}</div>
              </div>
              <span>{chat.messageCount}</span>
              <div class="btn btn-sm btn-circle btn-ghost" onclick={(e) => deleteChat(chat, e)}>
                <IconTrash size={16} />
              </div>
            </div>
          </li>
        )}
      </For>

      <div class="divider" />

      <li class="text-xs label mx-3">{t('Assistant Note')}</li>
      <div class="p-3">
        <textarea
          onBlur={saveNote}
          name="note"
          class="w-full textarea field-sizing-content"
          value={chatList.data?.assistantNote ?? ''}
          placeholder={t('Write something assistant will remember...')}
        />
      </div>
    </ul>
  )
}
