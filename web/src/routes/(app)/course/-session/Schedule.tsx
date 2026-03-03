import { IconCircle, IconCircleCheckFilled, IconHelpCircle } from '@tabler/icons-solidjs'
import { differenceInDays, format, isValid, parseISO } from 'date-fns'
import { createMemo, For, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'
import { useSession } from './context'

interface CalendarEvent {
  id: string
  title: string
  type: 'assessment' | 'lesson'
  startDate: Date
  endDate: Date
  typeLabel?: string
  number?: number
}

const EVENT_TYPE_COLORS = {
  discussion: 'bg-primary',
  assignment: 'bg-success',
  exam: 'bg-error',
  quiz: 'bg-warning',
} as const

const LESSON_COLOR = 'bg-neutral'

const getEventColor = (event: CalendarEvent): string => {
  if (event.type === 'lesson') return LESSON_COLOR

  const key = event.typeLabel?.toLowerCase() as keyof typeof EVENT_TYPE_COLORS
  return EVENT_TYPE_COLORS[key] ?? 'bg-neutral'
}

export const Schedule = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!
  const course = () => session.data!.course

  const events = createMemo(() => {
    const list: CalendarEvent[] = []

    course().lessons?.forEach((lesson, index) => {
      const startDate = parseISO(lesson.startDate)
      const endDate = parseISO(lesson.endDate)
      if (isValid(startDate) && isValid(endDate)) {
        list.push({
          id: `lesson-${lesson.id}`,
          title: `Lesson ${index + 1}`,
          type: 'lesson',
          startDate,
          endDate,
          number: index + 1,
        })
      }
    })

    course().gradingCriteria?.forEach((policy, index) => {
      if (!policy.startDate || !policy.endDate) return
      if (policy.model.toLowerCase() === 'completion') return
      const startDate = parseISO(policy.startDate)
      const endDate = parseISO(policy.endDate)
      if (isValid(startDate) && isValid(endDate)) {
        list.push({
          id: `policy-${index}`,
          title: policy.label,
          type: 'assessment',
          startDate,
          endDate,
          typeLabel: policy.model,
        })
      }
    })

    return list.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  })

  const dateRange = createMemo(() => {
    const allEvents = events()
    if (allEvents.length === 0) return { start: new Date(), end: new Date(), totalDays: 0 }

    const start = new Date(Math.min(...allEvents.map((e) => e.startDate.getTime())))
    const end = new Date(Math.max(...allEvents.map((e) => e.endDate.getTime())))
    const totalDays = differenceInDays(end, start)

    return { start, end, totalDays }
  })

  const getPosition = (date: Date) => {
    const range = dateRange()
    const days = differenceInDays(date, range.start)
    return (days / range.totalDays) * 100
  }

  const getWidth = (start: Date, end: Date) => {
    const range = dateRange()
    const days = differenceInDays(end, start)
    return Math.max((days / range.totalDays) * 100, 0.5)
  }

  const courseStart = new Date(s().accessDate.start)
  const courseEnd = new Date(s().accessDate.end)
  const courseArchive = new Date(s().accessDate.archive)
  const now = new Date()

  const monthMarkers = createMemo(() => {
    const range = dateRange()
    const markers: { date: Date; position: number; label: string }[] = []

    const current = new Date(range.start.getFullYear(), range.start.getMonth(), 1)

    while (current <= range.end) {
      if (current >= range.start) {
        markers.push({
          date: new Date(current),
          position: getPosition(current),
          label: format(current, 'MMM yyyy'),
        })
      }

      current.setMonth(current.getMonth() + 1)
    }

    return markers
  })

  return (
    <Show when={events().length > 0}>
      <div class="flex flex-col gap-12">
        <div>
          <p class="font-bold text-sm text-center">{t('Course schedule')}</p>
          <ul class="timeline justify-center max-w-5xl w-full">
            <li class="min-w-50 w-fll">
              <div class="timeline-start">{t(courseStart.toLocaleDateString())}</div>
              <div class="timeline-middle">
                <Show when={now > courseStart} fallback={<IconCircle size={24} />}>
                  <IconCircleCheckFilled size={24} />
                </Show>
              </div>
              <div class="timeline-end timeline-box">{t('Start')}</div>
              <hr />
            </li>
            <li class="min-w-50 w-fll">
              <hr />
              <div class="timeline-start">{t(courseEnd.toLocaleDateString())}</div>
              <div class="timeline-middle">
                <Show when={now > courseEnd} fallback={<IconCircle size={24} />}>
                  <IconCircleCheckFilled size={24} />
                </Show>
              </div>
              <div class="timeline-end timeline-box">{t('End')}</div>
              <hr />
            </li>
            <li class="min-w-50 w-fll">
              <hr />
              <div class="timeline-start">{t(courseArchive.toLocaleDateString())}</div>
              <div class="timeline-middle">
                <Show when={now > courseArchive} fallback={<IconCircle size={24} />}>
                  <IconCircleCheckFilled size={24} />
                </Show>
              </div>
              <div class="timeline-end timeline-box">
                <div class="tooltip" data-tip={t('After the end of the period, the course will not be accessible.')}>
                  <span class="flex items-center gap-1">
                    {t('Archive')} <IconHelpCircle size={16} />
                  </span>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-150">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-28 shrink-0"></div>
              <div class="flex-1 relative h-8 border-b border-base-300">
                <For each={monthMarkers()}>
                  {(marker, index) => (
                    <>
                      <div class="absolute top-0 bottom-0 w-px bg-base-300" style={{ left: `${marker.position}%` }} />
                      <div
                        class="absolute text-xs text-base-content/60 font-medium whitespace-nowrap"
                        style={{
                          left: index() === monthMarkers().length - 1 ? 'auto' : `${marker.position}%`,
                          right: index() === monthMarkers().length - 1 ? '0' : 'auto',
                          transform: index() === monthMarkers().length - 1 ? 'none' : 'translateX(-50%)',
                        }}
                      >
                        {marker.label}
                      </div>
                    </>
                  )}
                </For>
              </div>
            </div>

            <div class="relative">
              <Show when={now >= dateRange().start && now <= dateRange().end}>
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-error/30 z-10 pointer-events-none"
                  style={{
                    left: `calc(${getPosition(now)}% + 7rem + 0.75rem)`,
                  }}
                />
              </Show>

              <div class="space-y-3">
                <For each={events()}>
                  {(event) => {
                    const left = getPosition(event.startDate)
                    const width = getWidth(event.startDate, event.endDate)
                    const color = getEventColor(event)
                    const showDateOnLeft = left + width / 2 > 50

                    const displayLabel =
                      event.type === 'lesson'
                        ? t('Lesson {{ordering}}', { ordering: event.number })
                        : event.typeLabel
                          ? t(capitalize(event.typeLabel))
                          : event.typeLabel

                    return (
                      <div class="flex items-center gap-3">
                        <div class="w-28 shrink-0">
                          <div class="text-sm font-medium truncate">
                            <Show when={event.type === 'lesson'} fallback={displayLabel}>
                              {displayLabel}
                            </Show>
                          </div>
                          <div class="text-xs text-base-content/60 truncate" title={event.title}>
                            {event.type === 'assessment' && event.title}
                          </div>
                        </div>

                        <div class="flex-1 relative">
                          <div class="h-6 bg-base-200 rounded-xs relative overflow-hidden">
                            <div
                              class={`absolute h-full ${color} rounded-xs opacity-80 hover:opacity-100 transition-opacity tooltip tooltip-top`}
                              data-tip={`${format(event.startDate, 'MMM d')} - ${format(event.endDate, 'MMM d')}`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                            >
                              <div class="flex items-center justify-center h-full px-1">
                                <span class="text-xs font-medium text-white truncate">
                                  <Show when={event.type === 'assessment'} fallback={`L${event.number}`}>
                                    {displayLabel}
                                  </Show>
                                </span>
                              </div>
                            </div>

                            <Show when={showDateOnLeft}>
                              <div
                                class="absolute text-xs text-base-content/60 whitespace-nowrap"
                                style={{
                                  right: `${100 - left + 1}%`,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                }}
                              >
                                {format(event.startDate, 'M/d')} - {format(event.endDate, 'M/d')}
                              </div>
                            </Show>

                            <Show when={!showDateOnLeft}>
                              <div
                                class="absolute text-xs text-base-content/60 whitespace-nowrap"
                                style={{
                                  left: `${left + width + 1}%`,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                }}
                              >
                                {format(event.startDate, 'M/d')} - {format(event.endDate, 'M/d')}
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
