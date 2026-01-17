import { useTransContext } from '@mbarzda/solid-i18next'
import { createFileRoute } from '@tanstack/solid-router'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { contentV1GetWatchMedias, learningV1GetReport, type WatchedMediaSchema } from '@/api'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { toHHMMSS } from '@/shared/utils'
import { ProgressBar } from '../-shared/ProgressBar'

export const Route = createFileRoute('/(app)/dashboard/report')({
  component: RouteComponent,
})

import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

function RouteComponent() {
  const [t] = useTransContext()
  const navigate = Route.useNavigate()

  const [period, setPeriod] = createSignal<'today' | 'week' | 'month'>('month')

  const range = createMemo(() => {
    const now = new Date()
    const formatDate = (date: Date) => format(date, 'yyyy-MM-dd')

    const p = period()
    if (p === 'today') return { start: formatDate(startOfDay(now)), end: formatDate(endOfDay(now)) }
    if (p === 'week') return { start: formatDate(startOfWeek(now)), end: formatDate(endOfWeek(now)) }
    return { start: formatDate(startOfMonth(now)), end: formatDate(endOfMonth(now)) }
  })

  const [report] = createCachedStore(
    'learningV1GetReport',
    () => ({ query: range() }),
    async (options) => {
      const { data } = await learningV1GetReport(options)
      return data
    },
  )

  const [watched, setObserverEl] = createCachedInfiniteStore(
    'contentV1GetWatchMedias',
    () => ({ query: range() }),
    async (options, page) => {
      const { data } = await contentV1GetWatchMedias({ ...options, query: { ...options.query, page } })
      return data
    },
  )

  const goToMedia = (watched: WatchedMediaSchema) => {
    navigate({
      to: `/media/${watched.mediaId}`,
      search: watched.context ? Object.fromEntries(new URLSearchParams(watched.context)) : undefined,
    })
  }

  return (
    <div class="max-w-5xl mx-auto space-y-16 flex flex-col">
      <div class="flex flex-col gap-8">
        <div class="join justify-end gap-1">
          <input
            class="join-item btn btn-sm h-6 rounded border-0"
            type="radio"
            name="options"
            aria-label={t('Today')}
            checked={period() === 'today'}
            onChange={() => setPeriod('today')}
          />
          <input
            class="join-item btn btn-sm h-6 rounded border-0"
            type="radio"
            name="options"
            aria-label={t('This week')}
            checked={period() === 'week'}
            onChange={() => setPeriod('week')}
          />
          <input
            class="join-item btn btn-sm h-6 rounded border-0"
            type="radio"
            name="options"
            aria-label={t('This month')}
            checked={period() === 'month'}
            onChange={() => setPeriod('month')}
          />
        </div>

        <Show when={report.data}>
          {(d) => (
            <>
              <div class="label text-base items-end gap-4">
                {period() === 'today'
                  ? t("Today's Activities")
                  : period() === 'week'
                    ? t("This week's Activities")
                    : period() === 'month'
                      ? t("This month's Activities")
                      : t('All time')}

                <span class="text-sm">
                  {range().start} - {range().end}
                </span>
              </div>

              <div class="stats shadow text-center">
                <span class="stat">
                  <div class="stat-title">{t('Enrolled Count')}</div>
                  <div class="stat-value text-6xl text-success">{d().enrollmentCount}</div>
                </span>

                <div class="stat">
                  <div class="stat-title">{t('Watch Media Count')}</div>
                  <div class="stat-value">{d().watchMediaCount}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">{t('Watch Time')}</div>
                  <div class="stat-value">{toHHMMSS(d().watchSeconds)}</div>
                </div>
              </div>

              <div class="stats shadow text-center">
                <div class="stat">
                  <div class="stat-title">{t('Exam')}</div>
                  <div class="stat-value">{d().examAttemptCount}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">{t('Assignment')}</div>
                  <div class="stat-value">{d().assignmentAttemptCount}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">{t('Discussion')}</div>
                  <div class="stat-value">{d().discussionAttemptCount}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">{t('Quiz')}</div>
                  <div class="stat-value">{d().quizAttemptCount}</div>
                </div>
                <div class="stat">
                  <div class="stat-title">{t('Survey')}</div>
                  <div class="stat-value">{d().surveySubmissionCount}</div>
                </div>
              </div>
            </>
          )}
        </Show>
      </div>

      <div class=" mx-auto space-y-2 flex flex-col w-full">
        <Show when={!watched.loading} fallback={<div class="skeleton h-5 w-30"></div>}>
          <div class="label text-sm">{t('{{count}} watched history found', { count: watched.count })}</div>
        </Show>

        <For each={watched.items}>{(item) => <Card media={item} onclick={() => goToMedia(item)} />}</For>

        <Show when={!watched.end}>
          <div ref={setObserverEl} class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg" />
          </div>
        </Show>
      </div>
    </div>
  )
}

interface CardProps {
  media: WatchedMediaSchema
  onclick: () => void
}

const Card = (props: CardProps) => {
  const [t] = useTransContext()

  return (
    <div class="flex gap-4 w-full cursor-pointer py-2 hover:bg-base-200" onclick={props.onclick}>
      <div class="relative self-start flex-1 max-w-40 overflow-hidden rounded-lg aspect-video border border-base-content/10">
        <img class="w-full aspect-video object-cover" src={props.media.thumbnail} alt={props.media.title} />
        <div class="badge badge-neutral absolute bottom-2 right-2 z-1 badge-sm">
          <span>{toHHMMSS(props.media.durationSeconds)}</span>
        </div>
        <ProgressBar
          contentId={props.media.mediaId}
          passingPoint={props.media.passingPoint}
          class="absolute bottom-0 left-0 w-full h-1.25 rounded-none"
        />
      </div>
      <div class="space-y-3 text-left flex-1">
        <div class="font-semibold text-neutral/snug text-lg flex items-center gap-2 line-clamp-1">
          {props.media.title}
        </div>
        <div class="flex items-center gap-2 mt-2">
          <div class="text-sm">
            {t('Last watched: {{time}}', { time: new Date(props.media.watched).toLocaleString() })}
          </div>
        </div>
      </div>
    </div>
  )
}
