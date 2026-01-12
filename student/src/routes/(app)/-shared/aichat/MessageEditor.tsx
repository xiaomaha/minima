import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, reset, valiForm } from '@modular-forms/solid'
import { IconPlus, IconSettings, IconX } from '@tabler/icons-solidjs'
import { createSignal, onMount, Show } from 'solid-js'
import { Transition } from 'solid-transition-group'
import type * as v from 'valibot'
import { assistantV1CreateChatMessage, type ChatMessageSchema, type ChatSchema } from '@/api'
import { vChatMessageCreateSchema } from '@/api/valibot.gen'
import { AI_CHAT_MAX_CHARACTERS, AI_CHAT_MIN_CHARACTERS, ATTACHMENT_MAX_COUNT, ATTACHMENT_MAX_SIZE } from '@/config'
import { SubmitButton } from '@/shared/SubmitButton'
import { initCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { showToast } from '@/shared/toast/store'
import { extractText } from '@/shared/utils'
import { TextEditor } from '../editor/TextEditor'
import { useChatContext } from './context'
import { Message } from './Message'
import { Settings } from './Settings'

export const MessageEditor = () => {
  const [t] = useTransContext()
  const [files, setFiles] = createSignal<File[]>([])
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [streamMessage, setStreamMessage] = createSignal<ChatMessageSchema | null>(null)
  const [abortController, setAbortController] = createSignal<AbortController | null>(null)

  const [chatForm, { Form, Field }] = createForm<v.InferInput<typeof vChatMessageCreateSchema>>({
    initialValues: { message: '', url: '' },
    validate: valiForm(vChatMessageCreateSchema),
  })

  const { activeChat, chatMessageStore, chatListStore } = useChatContext()
  const [, , { setStore: setChatMessages }] = chatMessageStore
  const [, { setStore: setChatList }] = chatListStore

  const flushMessage = (chatId: number, completed?: string) => {
    if (!streamMessage()) return

    // new chat message
    setChatMessages('items', (prev) => [{ ...streamMessage()!, completed: completed ?? null }, ...prev])
    setStreamMessage(null)

    // update chat list
    setChatList(
      'data',
      'chats',
      (prev) => prev.id === chatId,
      (prev) => prev && { ...prev, messageCount: prev.messageCount + 1 },
    )
  }

  const onSubmit = async ({ message }: v.InferInput<typeof vChatMessageCreateSchema>) => {
    if (isStreaming()) return
    setIsStreaming(true)

    const controller = new AbortController()
    setAbortController(controller)

    // sse stream
    const { stream } = await assistantV1CreateChatMessage({
      body: { message, url: location.pathname + location.search, files: files(), chatId: activeChat()?.id },
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
          setStreamMessage(data as ChatMessageSchema)
          resetEditor()
        } else if (event === 'chunk') {
          setStreamMessage(
            (prev) => prev && { ...prev, response: prev.response + (data as { response: string }).response },
          )
        } else if (event === 'done') {
          flushMessage(chatId, (data as { completed: string }).completed)
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

    const chatId = activeChat()?.id
    if (chatId) flushMessage(chatId)
  }

  const resetEditor = () => {
    reset(chatForm)
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

  // cf. MessageList py-4
  const streadmFixingPosition = 'mb-4 -mt-4'

  return (
    <>
      <Transition
        onEnter={(el, done) => {
          const a = el.animate(
            [
              { opacity: 0, transform: 'translateY(20px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { duration: 300, easing: 'ease-out' },
          )
          a.finished.then(done)
        }}
        onExit={(_, done) => done()}
      >
        <Show when={streamMessage()}>
          <div class={`relative max-w-5xl mx-auto ${streadmFixingPosition}`}>
            <Message message={streamMessage()!} bot={activeChat()?.bot} />

            <div class="inset-x-0 -bottom-2 absolute gap-2 flex items-center justify-center">
              <div class="skeleton w-24 h-2" />
              <button type="button" onclick={stopStreaming} class="btn btn-xs btn-circle btn-ghost">
                <IconX size={12} class="text-base-content/40" />
              </button>
            </div>
          </div>
        </Show>
      </Transition>
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

          <Field name="url">{() => null}</Field>

          <fieldset class="flex gap-2 items-center" disabled={isStreaming() && !abortController()}>
            <SubmitButton
              label={t('Send Message')}
              isPending={isStreaming()}
              disabled={!chatForm.dirty}
              class="flex-1 btn btn-sm btn-neutral"
            />

            <button
              title={t('Start New Chat')}
              disabled={!chatForm.dirty && !activeChat()}
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
