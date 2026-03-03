import { IconRefresh, IconSearch } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createRoot, createSignal, For, Show } from 'solid-js'
import * as v from 'valibot'
import { type StudioContentSpec, studioV1Content } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'

const searchSchema = v.object({
  kind: v.optional(v.picklist(['survey', 'quiz', 'exam', 'assignment', 'discussion', 'media', 'course'])),
})

const [search, setSearch] = createRoot(() => createSignal(''))

export const Route = createFileRoute('/studio/')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const qs = Route.useSearch()

  const [contents, setObserverEl, { refetch }] = createCachedInfiniteStore(
    'studioV1History',
    () => ({ search: search() ? search() : undefined, kind: qs().kind }),
    async (options, page) => (await studioV1Content({ query: { page, ...options } })).data,
  )

  const goToContent = (model: StudioContentSpec['model'], contentId: string) => {
    navigate({ to: `/studio/${model}/${contentId}` })
  }

  const selectFilter = (filter: StudioContentSpec['model'] | 'all') => {
    navigate({
      search: (prev) => ({ ...prev, kind: filter === 'all' ? undefined : filter }),
    })
  }

  return (
    <div class="py-4 relative space-y-8">
      <div class="flex gap-2 items-center label text-sm relative">
        <div>{t('{{count}} learning object', { count: contents.count })}</div>

        <div class="absolute right-0 -top-1 flex gap-4 items-center">
          <label class="input border-0 input-primary bg-transparent shadow-none outline-0">
            <IconSearch class="shrink-0 cursor-pointer" />
            <input type="search" placeholder={t('Title search')} onChange={(e) => setSearch(e.target.value)} />
          </label>

          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle"
            onClick={() => refetch()}
            disabled={contents.loading}
          >
            <IconRefresh class="shrink-0" />
          </button>

          <select
            onChange={(e) => selectFilter(e.target.value as StudioContentSpec['model'] | 'all')}
            value={qs().kind ?? 'all'}
            name="filter"
            class={
              'select [&::picker(select)]:bg-base-100 [&::picker(select)]:mt-0 bg-transparent ' +
              'select select-ghost w-auto select-primary text-sm min-w-32 outline-0'
            }
          >
            <option value={'all'}>{t('All')}</option>
            <For each={['survey', 'quiz', 'exam', 'assignment', 'discussion', 'media', 'course']}>
              {(model) => <option value={model}>{t(capitalize(model))}</option>}
            </For>
          </select>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <For each={contents.items}>
          {(item) => (
            <div onclick={() => goToContent(item.model, item.id)} class="cursor-pointer">
              <Card content={item} />
            </div>
          )}
        </For>
      </div>

      <Show when={contents.end && contents.count === 0}>
        <NoContent message={t('No content')} />
      </Show>

      <Show when={!contents.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>
    </div>
  )
}

const Card = (props: { content: StudioContentSpec }) => {
  const { t } = useTranslation()

  return (
    <div class="flex gap-4 hover:bg-base-200/50 p-2 -mx-2 rounded-box">
      <img src={props.content.thumbnail} alt={props.content.title} class="h-24 rounded object-cover aspect-video" />

      <div class="flex-1 flex flex-col gap-2">
        <div class="flex gap-2 items-center">
          <div class="badge-xs badge badge-primary">{t(capitalize(props.content.model))}</div>
          <Show when={props.content.published}>
            <div class={`badge badge-xs badge-success text-base-100`}>{t('Published')}</div>
          </Show>
        </div>
        <div class="font-semibold line-clamp-1">{props.content.title}</div>
        <div class="label text-xs flex gap-2">
          <div>{t('Created at {{date}}', { date: new Date(props.content.created).toLocaleString() })}</div>|
          <div>
            {t('Modified at {{date}}', { date: formatDistanceToNow(props.content.edited ?? props.content.modified) })}
          </div>
        </div>
      </div>
    </div>
  )
}
