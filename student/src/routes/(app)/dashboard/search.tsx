import { createFileRoute, useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Show } from 'solid-js'
import * as v from 'valibot'
import { contentV1Search, type SearchedMediaSchema } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { extractText, timeToSeconds, toHHMMSS, toYYYYMMDD } from '@/shared/utils'
import { ProgressBar } from '../-shared/ProgressBar'

const searchSchema = v.object({
  q: v.optional(v.pipe(v.string())),
})

const [q, setQ] = createSignal('')

export const Route = createFileRoute('/(app)/dashboard/search')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const q_ = () => search().q

  createEffect(() => {
    if (q_() === q()) return
    setQ((prev) => (q_() ? q_()! : prev))
  })

  const [medias, setObserverEl] = createCachedInfiniteStore(
    'contentV1Search',
    () => ({ query: { q: q() ?? '' } }),
    async (options, page) => {
      const { data } = await contentV1Search({ ...options, query: { q: q(), page } })
      return data
    },
  )

  const goToMedia = (media: SearchedMediaSchema) => {
    if (!media.accessible) {
      showToast({
        title: t('Private'),
        message: t('This media is private'),
        type: 'error',
      })
      return
    }
    navigate({ to: `/media/${media.id}` })
  }

  return (
    <div class="max-w-5xl mx-auto space-y-8 flex flex-col">
      <Show when={!medias.loading} fallback={<div class="skeleton h-5 w-30"></div>}>
        <div class="label text-sm">{t('{{count}} result found', { count: medias.count })}</div>
      </Show>

      <For each={medias.items}>{(item) => <Card media={item} q={q()} onclick={() => goToMedia(item)} />}</For>

      <Show when={medias.end && medias.count === 0}>
        <NoContent message={t('No media found')} />
      </Show>

      <Show when={!medias.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>
    </div>
  )
}

interface CardProps {
  media: SearchedMediaSchema
  q: string | undefined
  onclick: () => void
}

const Card = (props: CardProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div
      class="flex gap-4 flex-col sm:flex-row max-w-100 w-full sm:max-w-none mx-auto cursor-pointer group"
      onclick={props.onclick}
    >
      <div class="relative self-start flex-1 max-w-92 overflow-hidden rounded-lg aspect-video border border-base-content/10">
        <img class="w-full aspect-video object-cover" src={props.media.thumbnail} alt={props.media.title} />
        <div class="badge badge-neutral absolute bottom-2 right-2 z-1 badge-sm">
          <span>{toHHMMSS(props.media.durationSeconds)}</span>
        </div>
        <ProgressBar
          contentId={props.media.id}
          passingPoint={props.media.passingPoint}
          class="absolute bottom-0 left-0 w-full h-1.25 rounded-none "
        />
      </div>
      <div class="space-y-3 text-left flex-1">
        <div class="font-semibold text-neutral/snug text-lg flex items-center gap-2">
          <Show when={!props.media.accessible}>
            <span class="badge badge-sm badge-error text-base-100">{t('Private')}</span>
          </Show>
          <Show when={props.media.featured}>
            <span class="badge badge-sm badge-primary">{t('Featured')}</span>
          </Show>
          <span class="line-clamp-1">{props.media.title}</span>
        </div>
        <div class="line-clamp-2 text-sm break-all">{extractText(props.media.description)}</div>
        <div class="flex items-center gap-2 mt-2">
          <Avatar user={props.media.owner} rounded />
          <div>
            <div class="font-semibold">{props.media.owner.nickname || props.media.owner.name}</div>
            <div class="text-xs">{toYYYYMMDD(new Date(props.media.modified))}</div>
          </div>
        </div>
        <Show when={props.q}>
          <div class="flex items-center gap-2 mt-4 flex-wrap">
            <For each={props.media.matchedLines?.slice(0, 5)}>
              {(line) => (
                <div
                  class="cursor-pointer badge badge-sm badge-primary not-[&:hover]:badge-soft max-w-60 block truncate"
                  innerHTML={`${line.start} - ${line.line.replaceAll(props.q!, '<mark>$&</mark>')}`}
                  onclick={(e) => {
                    if (props.media.accessible) {
                      e.stopPropagation()
                      navigate({
                        to: `/media/${props.media.id}`,
                        search: { start: timeToSeconds(line.start) },
                      })
                    }
                  }}
                />
              )}
            </For>
            <Show when={(props.media.matchedLines?.length ?? 0) > 5}>
              <span class="ml-4 text-xs label">{t('and more...')}</span>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}
