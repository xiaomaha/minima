import { useTransContext } from '@mbarzda/solid-i18next'
import { IconRefresh } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, For, Show, Suspense } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import {
  type CatalogItemSchema,
  type CatalogSchema,
  learningV1EnrollCatalogItem,
  learningV1GetCatalogItems,
  learningV1GetCatalogs,
} from '@/api'
import { Avatar } from '@/shared/Avatar'
import { Dialog } from '@/shared/Diaglog'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { capitalize, extractText, toHHMMSS, toYYYYMMDD } from '@/shared/utils'
import { ProgressBar } from '../-shared/ProgressBar'
import { useNewEnrollment } from './-context'

export const Route = createFileRoute('/(app)/dashboard/catalog')({
  component: RouteComponent,
})

function RouteComponent() {
  const [t] = useTransContext()

  const [catalogs] = createCachedStore(
    'learningV1GetCatalogs',
    () => ({}),
    async (params) => {
      const { data } = await learningV1GetCatalogs(params)
      return data
    },
  )

  return (
    <div class="max-w-5xl mx-auto space-y-8 flex flex-col">
      <div class="label text-sm">{t('You can enroll the content of the following catalogs')}</div>
      <For each={catalogs.data}>{(catalog) => <CatalogCard catalog={catalog} onclick={() => {}} />}</For>
    </div>
  )
}

interface CatalogCardProps {
  catalog: CatalogSchema
  onclick: () => void
}

const CatalogCard = (props: CatalogCardProps) => {
  const [t] = useTransContext()
  const [open, setOpen] = createSignal(false)

  return (
    <>
      <div class="card bg-base-100 w-full shadow-sm">
        <div class="card-body">
          <h2 class="card-title mt-0">{props.catalog.name}</h2>
          <p class="text-base-content/60">{props.catalog.description}</p>
          <div class="flex gap-8">
            <div class="space-y-1">
              <div class="label">{t('Available Period')}</div>
              <p class="font-semibold">
                {new Date(props.catalog.availableFrom).toLocaleDateString()} ~{' '}
                {new Date(props.catalog.availableUntil).toLocaleDateString()}
              </p>
            </div>
            <div class="space-y-1">
              <div class="label">{t('Content Count')}</div>
              <p class="font-semibold">{props.catalog.itemCount}</p>
            </div>
          </div>
          <div class="card-actions justify-between flex-nowrap items-center">
            <div class="label text-xs">
              {t('After this period ends, enrolled content will no longer be accessible.')}
            </div>
            <button type="button" class="btn btn-primary" onClick={() => setOpen(true)}>
              {t('View Catalog Content')}
            </button>
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        <ItemList catalog={props.catalog} open={open()} setOpen={setOpen} />
      </Suspense>
    </>
  )
}

interface ItemListProps {
  catalog: CatalogSchema
  open: boolean
  setOpen: (open: boolean) => void
}

const ItemList = (props: ItemListProps) => {
  const [t] = useTransContext()

  const [items, setObserverEl, { setStore, refetch }] = createCachedInfiniteStore(
    'learningV1GetCatalogItems',
    () => (props.open ? { path: { id: props.catalog.id } } : undefined),
    async (options, page) => {
      const { data } = await learningV1GetCatalogItems({ ...options, query: { page } })
      return data
    },
  )

  return (
    <Dialog
      title={
        <div class="flex items-center gap-2 justify-between">
          {t('Catalog Content')}
          <span>{`${items.page} / ${items.pages}`}</span>
        </div>
      }
      boxClass="max-w-5xl"
      open={items.items.length > 0}
      onClose={() => props.setOpen(false)}
    >
      <div class="p-8 pt-2">
        <div class="label text-sm mb-6 flex items-center justify-between">
          {t('Enrolled content will be displayed Learning tab.')}
          <button type="button" class="btn btn-sm btn-ghost btn-circle" onClick={refetch}>
            <IconRefresh />
          </button>
        </div>
        <div class="max-w-5xl mx-auto flex flex-col gap-6">
          <For each={items.items}>
            {(item) => <ItemCard catalogId={props.catalog.id} item={item} setStore={setStore} />}
          </For>
          <Show when={!items.end}>
            <div ref={setObserverEl} class="flex justify-center py-8">
              <span class="loading loading-spinner loading-lg" />
            </div>
          </Show>
        </div>
      </div>
    </Dialog>
  )
}

interface ItemCardProps {
  catalogId: number
  item: CatalogItemSchema
  setStore: SetStoreFunction<{ items: CatalogItemSchema[] }>
}

const ItemCard = (props: ItemCardProps) => {
  const [t] = useTransContext()
  const content = props.item.content

  const newNewEnrollments = useNewEnrollment()

  const [isLoadnig, setIsLoading] = createSignal(false)
  const enrollContent = async () => {
    setIsLoading(true)

    try {
      const { data } = await learningV1EnrollCatalogItem({
        path: { id: props.catalogId },
        body: {
          contentId: props.item.content.id,
          appLabel: props.item.contentType.appLabel,
          model: props.item.contentType.model,
        },
      })
      // update catalog cache
      props.setStore('items', (prev) => prev.id === props.item.id, 'enrolled', true)
      // update enrollment cache
      newNewEnrollments.push({ ...data, content: props.item.content, contentType: props.item.contentType })
    } catch (_) {
      // This error will be handled in global error handler
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div class="flex gap-4 flex-col sm:flex-row max-w-100 w-full sm:max-w-none mx-auto">
      <div class="relative self-start flex-1 sm:max-w-60 overflow-hidden rounded-lg aspect-video border border-base-300">
        <img class="w-full aspect-video object-cover" src={content.thumbnail!} alt={content.title} />
        <ProgressBar
          contentId={props.item.content.id}
          passingPoint={props.item.content.passingPoint}
          class="absolute bottom-0 left-0 w-full h-1.25 rounded-none "
        />
        <div class="badge badge-neutral absolute bottom-2 left-2 z-1 badge-sm">
          <span>{t(capitalize(content.format || props.item.contentType.model))}</span>
          <Show when={content.durationSeconds}>
            <span>{toHHMMSS(content.durationSeconds!)}</span>
          </Show>
        </div>
      </div>
      <div class="space-y-1 text-left flex-1">
        <div class="font-semibold text-neutral/snug text-lg flex items-center gap-2">
          <Show when={content.featured}>
            <span class="badge badge-sm badge-accent">{t('Featured')}</span>
          </Show>
          <span>{content.title}</span>
        </div>
        <div class="text-sm break-all text-base-content/70">{extractText(content.description)}</div>
        <div class="flex items-center gap-2 mt-2">
          <Avatar user={content.owner} rounded size="sm" />
          <div>
            <div class="font-semibold text-sm">{content.owner.nickname || content.owner.name}</div>
            <div class="text-xs">{toYYYYMMDD(new Date(content.modified))}</div>
          </div>
        </div>
        <div class="label text-xs">{content.audience}</div>
      </div>
      <div class="min-w-20 flex justify-center items-start mb-4">
        <Show when={!props.item.enrolled} fallback={<div class="text-xs text-base-content/40">{t('Enrolled')}</div>}>
          <button onClick={enrollContent} type="button" class="btn btn-sm btn-primary" data-tip={t('Enroll this content')}>
            <Show when={!isLoadnig()} fallback={<span class="loading loading-xs loading-spinner"></span>}>
              {t('Enroll')}
            </Show>
          </button>
        </Show>
      </div>
    </div>
  )
}
