import { IconPlus, IconSettings, IconX } from '@tabler/icons-solidjs'
import { createSignal, onMount, Show } from 'solid-js'
import type * as v from 'valibot'
import { assistantV1ChatMessage, type ChatMessageSchema, type ChatSchema } from '@/api'
import { vChatMessageCreateSchema } from '@/api/valibot.gen'
import { AI_CHAT_MAX_CHARACTERS, AI_CHAT_MIN_CHARACTERS, ATTACHMENT_MAX_COUNT, ATTACHMENT_MAX_SIZE } from '@/config'
import { SubmitButton } from '@/shared/SubmitButton'
import { initCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { extractText } from '@/shared/utils'
import { TextEditor } from '../editor/TextEditor'
import { useChatContext } from './context'
import { Settings } from './Settings'

export const MessageEditor = () => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [abortController, setAbortController] = createSignal<AbortController | null>(null)

  const [formState, { Form, Field, reset }] = createForm<v.InferInput<typeof vChatMessageCreateSchema>>({
    initialValues: { message: '', path: '' },
    validate: valiForm(vChatMessageCreateSchema),
  })

  const { activeChat, chatMessageStore, chatListStore } = useChatContext()
  const [, , { setStore: setChatMessages }] = chatMessageStore
  const [, { setStore: setChatList }] = chatListStore

  const onSubmit = async ({ message }: v.InferInput<typeof vChatMessageCreateSchema>) => {
    if (isStreaming()) return
    setIsStreaming(true)

    const controller = new AbortController()
    setAbortController(controller)

    // sse stream
    const { stream } = await assistantV1ChatMessage({
      body: { message, path: location.pathname + location.search, files: files(), chatId: activeChat()?.id },
      signal: controller.signal,

      onSseError: (error) => {
        if (!(error instanceof Error)) return

        console.error(error)
        showToast({
          title: t('Assistant Error'),
          message: error.message,
          type: 'error',
          duration: 1000 * 3,
        })
      },

      onSseEvent: ({ event, data }) => {
        if (event === 'chat') {
          // set messagelist cache before updating chat list
          // to avoid race condition with auto fetching chat messages
          const d = data as ChatSchema
          initCachedInfiniteStore('assistantV1GetChatMessages', { path: { id: d.id } })

          // new chat
          setChatList('data', (prev) => ({
            chats: [d, ...(prev?.chats ?? [])],
            assistantNote: prev?.assistantNote ?? null,
          }))
          return
        }

        const chatId = activeChat()?.id
        if (!chatId) return

        if (event === 'message') {
          setChatMessages('items', (prev) => [data as ChatMessageSchema, ...prev])
          resetEditor()
        } else if (event === 'chunk') {
          setChatMessages('items', 0, 'response', (prev) => prev + (data as { response: string }).response)
        } else if (event === 'done') {
          setChatMessages('items', 0, 'completed', (data as { completed: string }).completed)
          // update chat list
          setChatList(
            'data',
            'chats',
            (prev) => prev.id === chatId,
            (prev) => prev && { ...prev, messageCount: prev.messageCount + 1 },
          )
        }
      },
    })

    for await (const _ of stream) {
      // consume stream
    }

    setIsStreaming(false)
    setAbortController(null)
  }

  const stopStreaming = () => {
    abortController()?.abort()
  }

  const resetEditor = () => {
    reset({})
    setFiles([])
    focusEditor()
  }

  const focusEditor = () => {
    const prosemirror = formRef?.querySelector('.ProseMirror') as HTMLElement
    prosemirror?.focus()
  }

  onMount(() => {
    setTimeout(focusEditor, 0)
  })

  const startNewChat = () => {
    resetEditor()
    if (activeChat()) {
      setChatList('data', 'chats', {}, 'active', false)
    }
  }

  let formRef: HTMLFormElement | undefined

  return (
    <>
      <Show when={isStreaming()}>
        <div class="relative mx-auto">
          <div class="inset-x-0 bottom-4 absolute gap-2 flex items-center justify-center">
            <div class="skeleton w-24 h-2" />
            <button type="button" onclick={stopStreaming} class="btn btn-xs btn-circle btn-ghost">
              <IconX size={12} class="text-base-content/40" />
            </button>
          </div>
        </div>
      </Show>
      <Form onSubmit={onSubmit} ref={formRef}>
        <fieldset class="fieldset w-full max-w-5xl mx-auto">
          <Field
            name="message"
            validate={(value) => {
              const length = extractText(value ?? '').length ?? 0
              return length < AI_CHAT_MIN_CHARACTERS
                ? t('Message must be at least {{num1}} characters. Current length: {{num2}}', {
                    num1: AI_CHAT_MIN_CHARACTERS,
                    num2: length,
                  })
                : length > AI_CHAT_MAX_CHARACTERS
                  ? t('Message must be less than {{num1}} characters. Current length: {{num2}}', {
                      num1: AI_CHAT_MAX_CHARACTERS,
                      num2: length,
                    })
                  : ''
            }}
          >
            {(field, fieldProps) => (
              <>
                <TextEditor
                  {...fieldProps}
                  value={field.value ?? ''}
                  class="min-h-25 max-h-200"
                  placeholder={t('Write your message here...')}
                  accept={['image/*']}
                  setFiles={setFiles}
                  maxFiles={ATTACHMENT_MAX_COUNT}
                  maxFileSize={ATTACHMENT_MAX_SIZE}
                  hideToolbar={true}
                />
                <span class="text-error">{field.error}</span>
              </>
            )}
          </Field>

          <Field name="path">{() => null}</Field>

          <fieldset class="flex gap-2 items-center" disabled={isStreaming() && !abortController()}>
            <SubmitButton
              label={t('Send Message')}
              isPending={isStreaming()}
              disabled={!formState.dirty}
              class="flex-1 btn btn-sm btn-neutral"
            />

            <button
              title={t('Start New Chat')}
              disabled={!formState.dirty && !activeChat()}
              type="button"
              class="btn btn-xs btn-circle btn-ghost"
              onClick={startNewChat}
            >
              <IconPlus size={20} />
            </button>

            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost"
              popovertarget="popover-1"
              style="anchor-name:--anchor-1"
            >
              <IconSettings size={20} />
            </button>
            <Settings />
          </fieldset>
        </fieldset>
      </Form>
    </>
  )
}
