import { createVisibilityObserver } from '@solid-primitives/intersection-observer'
import { IconArrowDown } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import { useChatContext } from './context'
import { Message } from './Message'

export const MessageList = () => {
  let topSentinel: HTMLDivElement | undefined
  let bottomSentinel: HTMLDivElement | undefined

  const isTopAtEnd = createVisibilityObserver({ threshold: 0 })(() => topSentinel)
  const isBottomAtEnd = createVisibilityObserver({ threshold: 0 })(() => bottomSentinel)

  let scrollContainer: HTMLDivElement | undefined
  const [showScrollButton, setShowScrollButton] = createSignal(false)

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement
    setShowScrollButton(Math.abs(target.scrollTop) > 300)
  }

  const scrollToBottom = () => {
    if (scrollContainer) {
      scrollContainer.scrollTop = 0
    }
  }

  const { chatMessageStore } = useChatContext()
  const [chatMessages, setObserverRef] = chatMessageStore
  const messageLength = () => chatMessages.items.length

  return (
    <div class="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        class="absolute top-0 left-0 right-0 h-2 z-20 pointer-events-none transition-opacity duration-200"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.06), transparent)',
          opacity: messageLength() && !isTopAtEnd() ? 1 : 0,
        }}
      />
      <div
        ref={scrollContainer}
        class="overflow-y-auto px-4 flex-1 flex flex-col-reverse min-h-0 overscroll-contain"
        onScroll={handleScroll}
      >
        <div ref={bottomSentinel} class="w-full shrink-0" />
        <div class="max-w-5xl w-full mx-auto flex flex-col-reverse">
          <For each={chatMessages.items}>{(item, i) => <Message message={item} i={messageLength() - i()} />}</For>

          <Show when={!chatMessages.end}>
            <div ref={setObserverRef} class="flex justify-center py-8">
              <span class="loading loading-spinner loading-lg"></span>
            </div>
          </Show>
        </div>
        <div ref={topSentinel} class="w-full shrink-0" />
      </div>
      <div
        class="absolute bottom-0 left-0 right-0 h-2 z-20 pointer-events-none transition-opacity duration-200"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.06), transparent)',
          opacity: messageLength() && !isBottomAtEnd() ? 1 : 0,
        }}
      />
      <Show when={showScrollButton()}>
        <button type="button" class="btn btn-circle absolute bottom-4 right-4 bg-transparent" onClick={scrollToBottom}>
          <IconArrowDown size={20} />
        </button>
      </Show>
    </div>
  )
}
