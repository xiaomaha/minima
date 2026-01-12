import { useTransContext } from '@mbarzda/solid-i18next'
import { IconDotsVertical } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createEffect, For, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { type EnrollmentSchema, learningV1GetEnrolled, learningV1Unenroll } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { capitalize, toHHMMSS } from '@/shared/utils'
import { ProgressBar } from '../-shared/ProgressBar'
import { useNewEnrollment } from './-context'

export const Route = createFileRoute('/(app)/dashboard/learning')({
  component: RouteComponent,
})

function RouteComponent() {
  const [enrollments, setObserverEl, { setStore }] = createCachedInfiniteStore(
    'learningV1GetEnrolled',
    () => ({ query: {} }),
    async (options, page) => {
      const { data } = await learningV1GetEnrolled({ ...options, query: { page } })
      return data
    },
  )

  const newEnrollments = useNewEnrollment()

  // merge new enrollments
  createEffect(() => {
    if (enrollments.loading || newEnrollments.length === 0) return
    const toAdd = newEnrollments
      .splice(0)
      .filter((item) => !enrollments.items.some((existing) => existing.id === item.id))
    if (toAdd.length > 0) {
      setStore({
        items: [...toAdd, ...enrollments.items],
        count: enrollments.count + toAdd.length,
      })
    }
  })

  return (
    <div>
      <div class="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
        <For each={enrollments.items}>{(item) => <ContentCard item={item} setStore={setStore} />}</For>
      </div>

      <Show when={!enrollments.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </Show>
    </div>
  )
}

interface ContentCardProps {
  item: EnrollmentSchema
  setStore: SetStoreFunction<{ items: EnrollmentSchema[] }>
}

const ContentCard = (props: ContentCardProps) => {
  const [t] = useTransContext()
  const navigate = Route.useNavigate()

  const contentPath = () => {
    switch (props.item.contentType.model) {
      case 'course':
      case 'exam':
      case 'assignment':
      case 'discussion':
        return `/${props.item.contentType.model}/${props.item.content.id}/session`
      case 'media':
        return `/${props.item.contentType.model}/${props.item.content.id}`
    }
  }

  const deactivate = async () => {
    await learningV1Unenroll({ path: { id: props.item.id } })
    props.setStore('items', (prev) => prev.filter((item) => item.id !== props.item.id))
  }

  return (
    <div
      class="cursor-pointer! w-full max-w-sm mx-auto flex flex-col text-left gap-3 group"
      onclick={() => navigate({ to: contentPath() })}
    >
      <div class="relative overflow-hidden rounded-md border border-base-300">
        <Show when={props.item.content.thumbnail} fallback={<div class="aspect-video w-full" />}>
          <img
            class="object-cover aspect-video w-full"
            src={props.item.content.thumbnail!}
            alt={props.item.content.description}
          />
        </Show>
        <div class="badge badge-neutral absolute bottom-2.5 left-2 badge-sm">
          <span>{t(capitalize(props.item.content.format || props.item.contentType.model))}</span>
          <Show when={props.item.content.durationSeconds}>
            <span>{toHHMMSS(props.item.content.durationSeconds!)}</span>
          </Show>
        </div>

        <ProgressBar
          contentId={props.item.content.id}
          passingPoint={props.item.content.passingPoint}
          class="absolute bottom-0 left-0 w-full h-1.25 group-hover:h-2 transition-[height] rounded-none"
        />
      </div>

      <div class="gap-3 p-0">
        <div class="flex gap-3 items-start">
          <Avatar user={props.item.content.owner} size="sm" rounded />

          <div class="flex-1 min-w-0">
            <div class="text-base font-semibold line-clamp-2 mb-0.5">{props.item.content.title}</div>
            <div class="text-sm opacity-70">{props.item.content.owner.nickname || props.item.content.owner.name}</div>
          </div>
        </div>
        <div class="text-sm label my-2 w-full relative">
          <span>
            {new Date(props.item.start!).toLocaleDateString()} ~ {new Date(props.item.end).toLocaleDateString()}
          </span>

          {/* TODO: Currenly only unenroll action is needed. */}
          <Show when={props.item.canDeactivate}>
            <details
              class="hidden group-hover:block dropdown dropdown-end absolute right-0 bottom-0"
              onclick={(e) => e.stopPropagation()}
            >
              <summary class="btn btn-sm btn-circle">
                <IconDotsVertical />
              </summary>
              <ul class="menu dropdown-content opacity-100! bg-base-100 rounded-box z-100 w-52 p-2 shadow-2xl">
                <li class="bg-transparent-0">
                  <button type="button" title={t('Remove this content from my learning list.')} onClick={deactivate}>
                    {t('Unenroll')}
                  </button>
                </li>
              </ul>
            </details>
          </Show>
        </div>
      </div>
    </div>
  )
}
