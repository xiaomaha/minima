import { createVisibilityObserver } from '@solid-primitives/intersection-observer'
import { IconSpeakerphone } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createEffect, For, onCleanup, onMount, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { type AnnounceSchema, operationV1GetAnnouncements, operationV1ReadAnnouncement } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { toYYYYMMDD } from '@/shared/utils'
import { useDashboard } from './-context'

export const Route = createFileRoute('/student/(dashboard)/announcement')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()

  const [announcements, setObserverEl, { setStore, refetch }] = createCachedInfiniteStore(
    'operationV1GetAnnouncements',
    () => ({}),
    async (options, page) => (await operationV1GetAnnouncements({ ...options, query: { page } })).data,
  )

  const { setRefreshHandler } = useDashboard()
  onMount(() => setRefreshHandler(() => refetch))
  onCleanup(() => setRefreshHandler(undefined))

  return (
    <div class="max-w-5xl mx-auto space-y-6">
      <For each={announcements.items}>
        {(item, i) => <AnnouncementItem item={item} numbering={announcements.count - i()} setStore={setStore} />}
      </For>

      <Show when={announcements.end && announcements.count === 0}>
        <NoContent icon={IconSpeakerphone} message={t('No announcement')} />
      </Show>

      <Show when={!announcements.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>
    </div>
  )
}

interface AnnouncementItemProps {
  item: AnnounceSchema
  numbering: number
  setStore: SetStoreFunction<{
    items: AnnounceSchema[]
  }>
}

const AnnouncementItem = (props: AnnouncementItemProps) => {
  const { t } = useTranslation()

  let articleRef: HTMLElement | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let hasMarked = false

  const isVisible = createVisibilityObserver({ threshold: 0.5 })(() => articleRef)

  createEffect(() => {
    if (isVisible() && !props.item.read && !hasMarked) {
      timeoutId = setTimeout(async () => {
        if (hasMarked) return
        hasMarked = true

        const { error } = await operationV1ReadAnnouncement({
          path: { id: props.item.id },
          throwOnError: false,
        })
        if (error) {
          hasMarked = false
          return
        }
        props.setStore('items', (prev) => prev.id === props.item.id, 'read', new Date().toISOString())
      }, 2000)
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }
  })

  onCleanup(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  return (
    <article ref={articleRef} class="max-w-full card p-4 bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center gap-4 text-sm label">
          <span class="text-sm opacity-40">#{props.numbering}</span>
          <time class="tooltip" data-tip={new Date(props.item.modified).toLocaleString()}>
            {toYYYYMMDD(new Date(props.item.modified))}
          </time>
          <div class="flex-1" />
          <Show when={props.item.read} fallback={<div class="status status-info" />}>
            <div
              class="tooltip tooltip-left"
              data-tip={t('Read at {{date}}', { date: new Date(props.item.read!).toLocaleString() })}
            >
              <div class="status" />
            </div>
          </Show>
        </div>
        <h2 class="card-title mt-4">{props.item.title}</h2>

        <ContentViewer content={props.item.body} class="mt-6" />
      </div>
    </article>
  )
}
