import { IconBell, IconRefresh } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createEffect, createSignal, For, onMount, Show } from 'solid-js'
import { type MessageSchema, operationV1GetUnreadMessages, operationV1ReadMessage } from '@/api'
import { accountStore } from '@/routes/(app)/account/-store'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'

export const Notification = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [enabled, setEnabled] = createSignal(false)

  const [messages, setObserverEl, { setStore, refetch }] = createCachedInfiniteStore(
    'operationV1GetUnreadMessages',
    () => (enabled() ? {} : undefined),
    async (options, page) => {
      const { data } = await operationV1GetUnreadMessages({ ...options, query: { page } })
      return data
    },
  )

  onMount(() => {
    setTimeout(() => {
      setEnabled(true)
    }, 1000 * 2)
  })

  const [unreadCount, setUnreadCount] = createSignal(0)

  createEffect(() => {
    if (!messages.count) return
    setUnreadCount(messages.count)
  })

  const closeDropdown = () => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur()
  }

  const readMessage = async (messageId: number) => {
    await operationV1ReadMessage({ path: { id: messageId } })
    // update cache
    setStore('items', (items) => items.id === messageId, 'read', new Date().toISOString())
    setUnreadCount(unreadCount() - 1)
  }

  const goToTarget = (item: MessageSchema) => {
    closeDropdown()

    if (!item.read) readMessage(item.id)

    if (item.data.path) {
      // appeal, inquiry, comment reply
      navigate({ to: item.data.path })
      return
    }

    switch (item.data.model) {
      case 'course':
      case 'assignment':
      case 'exam':
      case 'discussion':
        navigate({ to: `/${item.data.model}/${item.data.id}/session` })
        break
      case 'inquiry':
        navigate({ to: '/dashboard/inquiry' })
        break
      case 'group':
        navigate({ to: '/account/group' })
        break
      case 'catalog':
        navigate({ to: `/dashboard/catalog` })
        break
      default:
        // enrollment
        navigate({ to: `/dashboard/learning` })
    }
  }

  return (
    <Show when={accountStore.user}>
      <div class="dropdown dropdown-end">
        <button tabindex={0} type="button" class="btn btn-circle btn-ghost">
          <div class="indicator">
            <Show when={unreadCount()}>
              <span class="indicator-item badge bg-red-600 badge-xs text-base-100">
                {unreadCount() > 99 ? '99+' : unreadCount()}
              </span>
            </Show>
            <IconBell size={28} />
          </div>
        </button>
        <div
          tabindex="0"
          class="rounded-box bg-base-100 dropdown-content shadow-2xl w-100 max-w-[calc(100vw-7em)] overflow-hidden"
        >
          <div class="border-b border-base-content/10 text-sm px-4 py-2 flex items-center justify-between">
            {t('Notification')}
            <button type="button" class="btn btn-ghost btn-xs btn-circle" onClick={refetch}>
              <IconRefresh size={20} />
            </button>
          </div>
          <div class="max-h-150 overflow-auto">
            <div class="[&>div+div]:border-t [&>div+div]:border-base-content/5">
              <For each={messages.items}>
                {(item) => <MessageLink item={item} onClick={() => goToTarget(item)} setRead={readMessage} />}
              </For>
            </div>

            <Show when={messages.end && messages.count === 0}>
              <NoContent small icon={IconBell} message={t('No unread notification')} />
            </Show>

            <Show when={!messages.end}>
              <div ref={setObserverEl} class="flex justify-center py-8">
                <span class="loading loading-spinner loading-lg"></span>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}

const MessageLink = (props: { item: MessageSchema; onClick: () => void; setRead: (messageId: number) => void }) => {
  const { t } = useTranslation()

  return (
    <div class="px-4 py-3 hover:bg-base-200 flex items-center gap-3">
      <div class="w-full space-y-0.5 cursor-pointer" onclick={props.onClick}>
        <div class="badge badge-xs badge-primary badge-soft">{t(capitalize(props.item.data.model))}</div>
        <div class="text-sm font-semibold">{props.item.title}</div>
        <div class="text-xs label flex items-center justify-between">
          {formatDistanceToNow(props.item.created, { addSuffix: true })}
        </div>
        <div class="text-sm text-base-content/70 line-clamp-1">{props.item.body}</div>
      </div>
      <Show
        when={!props.item.read}
        fallback={
          <div class="btn btn-ghost btn-circle btn-sm btn-disabled">
            <div class="status" />
          </div>
        }
      >
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          onMouseDown={(e) => e.preventDefault()}
          onclick={() => props.setRead(props.item.id)}
          title={t('Mark as read')}
        >
          <div class="status status-info" />
        </button>
      </Show>
    </div>
  )
}
