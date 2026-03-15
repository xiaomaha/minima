import { IconDotsVertical } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createEffect, createSignal, For, onCleanup, type Setter, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import * as v from 'valibot'
import { type EnrollmentSchema, learningV1GetEnrolled, learningV1Unenroll } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { Trans, useTranslation } from '@/shared/solid/i18n'
import { capitalize, toHHMMSS } from '@/shared/utils'
import { ProgressBar } from '../-shared/ProgressBar'
import { QuizDialog } from '../-shared/quiz/QuizDialog'
import { useDashboard } from './-context'

const searchSchema = v.object({
  quiz: v.optional(v.string()),
})

export const Route = createFileRoute('/student/(dashboard)/learning')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [enrollments, setObserverEl, { setStore }] = createCachedInfiniteStore(
    'learningV1GetEnrolled',
    () => ({ query: {} }),
    async (options, page) => (await learningV1GetEnrolled({ ...options, query: { page } })).data,
  )

  const { newEnrollments } = useDashboard()

  // merge new enrollments
  createEffect(() => {
    if (enrollments.loading || newEnrollments.length === 0) return
    const toAdd = newEnrollments
      .splice(0)
      .reverse()
      .filter((item) => !enrollments.items.some((existing) => existing.id === item.id))
    if (toAdd.length > 0) {
      setStore({
        items: [...toAdd, ...enrollments.items],
        count: enrollments.count + toAdd.length,
      })
    }
  })

  const [activeQuiz, setActiveQuiz] = createSignal<string>()

  createEffect(() => {
    if (search().quiz) setActiveQuiz(search().quiz)
  })

  return (
    <>
      <div>
        <div class="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
          <For each={enrollments.items}>
            {(item) => <ContentCard item={item} setStore={setStore} setQuizId={setActiveQuiz} />}
          </For>
        </div>

        <Show when={enrollments.end && enrollments.count === 0}>
          <NoContent message={t('No content enrolled yet.')} class="my-16">
            <div class="text-base-content/70 space-y-6 mt-2">
              <div class="flex items-center justify-center">
                <Trans>
                  You can enroll content from the catalogs in{' '}
                  <button
                    type="button"
                    class="ml-1 link link-info"
                    onclick={() => navigate({ to: '/student/catalog' })}
                  >
                    the Catalog tab
                  </button>
                </Trans>
              </div>
              <div class="flex items-center justify-center">
                <Trans>
                  Public content can be searched in{' '}
                  <button type="button" class="ml-1 link link-info" onclick={() => navigate({ to: '/student/search' })}>
                    the Search tab
                  </button>
                </Trans>
              </div>
            </div>
          </NoContent>
        </Show>

        <Show when={!enrollments.end}>
          <div ref={setObserverEl} class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>
      </div>

      <Show when={activeQuiz()}>
        <QuizDialog id={activeQuiz()!} open={!!activeQuiz()} onClose={() => setActiveQuiz()} />
      </Show>
    </>
  )
}

interface ContentCardProps {
  item: EnrollmentSchema
  setStore: SetStoreFunction<{ items: EnrollmentSchema[]; count: number }>
  setQuizId?: Setter<string | undefined>
}

const ContentCard = (props: ContentCardProps) => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const contentPath = () => {
    switch (props.item.contentType.model) {
      case 'course':
        return '/student/course/$id/session'
      case 'exam':
        return '/student/exam/$id/session'
      case 'assignment':
        return '/student/assignment/$id/session'
      case 'discussion':
        return '/student/discussion/$id/session'
      case 'media':
        return '/student/media/$id'
      case 'survey':
        return '/public/survey/$id'
    }
  }

  const deactivate = async () => {
    await learningV1Unenroll({ path: { id: props.item.id } })
    props.setStore('items', (prev) => prev.filter((item) => item.id !== props.item.id))
    props.setStore('count', (prev) => prev - 1)
  }

  const [started, setStarted] = createSignal(new Date(props.item.start) <= new Date())

  const openContent = () => {
    if (!started()) return

    if (props.item.contentType.model === 'quiz') {
      props.setQuizId?.(props.item.content.id)
    } else {
      navigate({ to: contentPath(), params: { id: props.item.content.id } })
    }
  }

  return (
    <div
      class="w-full max-w-sm mx-auto flex flex-col text-left gap-3 group"
      onclick={openContent}
      classList={{ 'cursor-pointer': started() }}
    >
      <div class="relative overflow-hidden rounded-md border border-base-300">
        <Show when={props.item.content.thumbnail} fallback={<div class="aspect-video w-full" />}>
          <img
            class="object-cover aspect-video w-full"
            src={props.item.content.thumbnail!}
            alt={props.item.content.title!}
          />
        </Show>
        <div class="badge badge-neutral absolute bottom-2.5 left-2 badge-sm">
          <span>{t(capitalize(props.item.content.format || props.item.contentType.model))}</span>
          <Show when={props.item.content.durationSeconds}>
            <span>{toHHMMSS(props.item.content.durationSeconds!)}</span>
          </Show>
        </div>

        <Show when={!started()}>
          <span class="badge bg-red-600 text-base-100 absolute top-2.5 left-2 badge-sm border-0">
            <Show
              when={new Date(props.item.start).getTime() - Date.now() < 60 * 60 * 24 * 1000}
              fallback={t('Starts {{to}}', {
                to: formatDistanceToNow(new Date(props.item.start), { addSuffix: true }),
              })}
            >
              {t('Start countdown')} <LiveCountdown start={new Date(props.item.start)} setStarted={setStarted} />
            </Show>
          </span>
        </Show>

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
            <div class="text-base/tight font-semibold line-clamp-2 mb-0.5">{props.item.content.title}</div>
            <div class="text-sm opacity-70 mt-1">
              {props.item.content.owner.nickname || props.item.content.owner.name}
            </div>
          </div>
        </div>
        <div class="text-sm label my-2 w-full relative justify-between">
          <Show
            when={props.item.content.format !== 'live'}
            fallback={
              <span class="flex gap-2 items-center">
                <span class="badge badge-sm bg-red-600 text-base-100">{t('Live')}</span>
                {new Date(props.item.start).toLocaleString()}
              </span>
            }
          >
            <span>
              {new Date(props.item.start).toLocaleDateString()} ~ {new Date(props.item.end).toLocaleDateString()}
            </span>
          </Show>

          <Show when={props.item.canDeactivate}>
            <div class="dropdown dropdown-end" onclick={(e) => e.stopPropagation()}>
              <button
                type="button"
                tabindex="0"
                class="btn btn-circle btn-ghost btn-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDotsVertical size={20} />
              </button>
              <ul
                tabindex="0"
                class="rounded-box bg-base-100 menu dropdown-content p-1 py-2 z-1 w-60 shadow-lg mt-1"
                onclick={(e) => e.stopPropagation()}
              >
                <li class="bg-transparent-0 mb-0">
                  <button type="button" title={t('Remove this content from my learning list.')} onClick={deactivate}>
                    {t('Unenroll')}
                  </button>
                </li>
              </ul>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

const LiveCountdown = (props: { start: Date; setStarted: Setter<boolean> }) => {
  const calculateTime = () => {
    const ms = props.start.getTime() - Date.now()
    if (ms <= 0) return null

    const seconds = Math.floor(ms / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return { hours, minutes, secs }
  }

  const [timeLeft, setTimeLeft] = createSignal(calculateTime())

  createEffect(() => {
    const interval = setInterval(() => {
      const time = calculateTime()
      if (!time) {
        clearInterval(interval)
        props.setStarted(true)
      }
      setTimeLeft(time)
    }, 1000)

    onCleanup(() => clearInterval(interval))
  })

  return (
    <Show when={timeLeft()}>
      {(time) => (
        <span class="countdown font-mono">
          <span style={`--value:${time().hours}`}>{time().hours}</span>:
          <span style={`--value:${time().minutes}`}>{time().minutes}</span>:
          <span style={`--value:${time().secs}`}>{time().secs}</span>
        </span>
      )}
    </Show>
  )
}
