import { IconHelpCircle, IconSquareCheck } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize, toYYYYMMDD } from '@/shared/utils'
import { getAverageProgress, getProgress } from '../../-shared/record'
import { useSession } from './context'

export const Outline = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [session] = useSession()
  const s = () => session.data!

  const gradebook = s().engagement?.gradebook
  const passingPoint = s().course.passingPoint || 0
  const passingProgressRate = s().course.gradingCriteria.find((p) => p.model === 'completion')?.passingPoint
  const now = new Date()

  let lessonNumber = 0
  const lessonAndSurveys = [
    ...s().course.lessons.map((lesson) => ({
      type: 'lesson' as const,
      number: ++lessonNumber,
      ...lesson,
    })),
    ...s().course.surveys.map((survey) => ({
      type: 'survey' as const,
      ...survey,
    })),
  ].sort((a, b) => {
    const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    if (dateCompare !== 0) return dateCompare
    return a.type === 'lesson' ? -1 : 1
  })

  return (
    <div class="max-w-5xl space-y-12">
      <div class="stats shadow mx-auto flex py-12">
        <div class="stat place-items-center">
          <div class="stat-title">{t('Progress')}</div>
          <div class="stat-value text-5xl my-4">
            <Show when={gradebook} fallback="-">
              {gradebook!.score}
            </Show>
          </div>
          <div class="stat-desc">{t('Minimum progress: {{num}}', { num: passingProgressRate })}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">{t('Score')}</div>
          <div class="stat-value text-5xl my-4">
            <Show when={gradebook} fallback="-">
              {gradebook!.completionRate.toFixed(1)}
            </Show>
          </div>
          <div class="stat-desc">{t('Passing point: {{num}}', { num: passingPoint })}</div>
        </div>
      </div>

      <div class="max-w-lg mx-auto">
        <p class="font-bold text-sm">{t('Course Progress')}</p>
        <CourseProgressBar accessDate={s().accessDate} />
      </div>

      <div class="min-w-200">
        <p class="font-bold text-sm">{t('Assessments')}</p>
        <table class="table tabular-nums">
          <thead>
            <tr class="text-neutral-400">
              <th class="w-0 font-light"></th>
              <th class="w-0 font-normal">{t('Type')}</th>
              <th class="font-normal">{t('Title')}</th>
              <th class="w-0 font-normal">
                <div class="tooltip" data-tip={t('Scoring below this points will result in course failure')}>
                  <span class="flex items-center gap-1">
                    {t('Pass')} <IconHelpCircle size={16} />
                  </span>
                </div>
              </th>
              <th class="w-0 font-normal">{t('Weight')}</th>
              <th class="font-normal">
                <div class="tooltip" data-tip={t('Content will be read only after the period')}>
                  <span class="flex items-center gap-1">
                    {t('Period')} <IconHelpCircle size={16} />
                  </span>
                </div>
              </th>
              <th class="w-0 font-normal">{t('Score')}</th>
              <Show when={s().engagement}>
                <th class="w-0 font-normal"></th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <For each={s().course.gradingCriteria}>
              {(policy, i) => {
                const startDate = new Date(policy.startDate!)
                const endDate = new Date(policy.endDate!)
                const notOpen = startDate > now

                return (
                  <tr>
                    <td>{i() + 1}</td>
                    <td class="whitespace-nowrap">{t(capitalize(policy.model))}</td>
                    <td>{policy.model === 'completion' ? t('Progress Rate') : policy.title}</td>
                    <td>{policy.passingPoint}</td>
                    <td>{policy.normalizedWeight.toFixed(1)}</td>
                    <td class="whitespace-nowrap">
                      {toYYYYMMDD(startDate)} - {toYYYYMMDD(endDate)}
                    </td>
                    <td>{getProgress(policy.itemId, `course=${s().course.id}`) ?? '-'}</td>

                    <Show when={s().engagement}>
                      <td class="py-0.5 whitespace-nowrap">
                        <Show when={policy.model !== 'completion'}>
                          <button
                            type="button"
                            disabled={notOpen}
                            class="btn btn-primary btn-sm"
                            onClick={() =>
                              navigate({
                                to: `/${policy.model}/${policy.itemId}/session`,
                                search: { course: s().course.id },
                              })
                            }
                          >
                            {t('View')}
                          </button>
                        </Show>
                      </td>
                    </Show>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>

      <div class="min-w-200">
        <p class="font-bold text-sm">{t('Lessons')}</p>
        <table class="table tabular-nums">
          <thead>
            <tr class="text-neutral-400">
              <th class="w-0 font-light"></th>
              <th class="font-normal">{t('Title')}</th>
              <th class="w-0 font-normal">{t('Period')}</th>
              <th class="font-normal">{t('Progress')}</th>
              <Show when={s().engagement}>
                <th class="w-0 font-normal"></th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <For each={lessonAndSurveys}>
              {(item) => {
                const startDate = new Date(item.startDate)
                const endDate = new Date(item.endDate)
                const notOpen = startDate > now

                return (
                  <tr>
                    <td>{item.type === 'lesson' ? item.number : <IconSquareCheck size={16} />}</td>
                    <td>{item.title}</td>
                    <td class="whitespace-nowrap">
                      {toYYYYMMDD(startDate)} - {toYYYYMMDD(endDate)}
                    </td>
                    <td>
                      <progress
                        class="progress progress-primary"
                        value={
                          item.type === 'lesson'
                            ? getAverageProgress(
                                item.medias.map((m) => m.id),
                                `course=${s().course.id}`,
                              )
                            : getProgress(item.surveyId, `course=${s().course.id}`)
                        }
                        max={100}
                      />
                    </td>
                    <Show when={s().engagement}>
                      <td class="py-0.5">
                        {item.type === 'lesson' ? (
                          <div class="flex flex-col gap-1">
                            {item.medias.map((media) => (
                              <button
                                type="button"
                                disabled={notOpen}
                                class="btn btn-primary btn-sm whitespace-nowrap w-full"
                                onClick={() =>
                                  navigate({ to: `/media/${media.id}`, search: { course: s().course.id } })
                                }
                              >
                                {t(capitalize(media.format))}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={notOpen}
                            class="btn btn-secondary btn-sm whitespace-nowrap w-full"
                            onClick={() =>
                              navigate({ to: `/survey/${item.surveyId}`, search: { course: s().course.id } })
                            }
                          >
                            {t('Survey')}
                          </button>
                        )}
                      </td>
                    </Show>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}

type CourseProgressBarProps = {
  accessDate: { start: string; end: string }
}

export const CourseProgressBar = (props: CourseProgressBarProps) => {
  const { t } = useTranslation()
  const now = new Date()
  const startDate = new Date(props.accessDate.start)
  const endDate = new Date(props.accessDate.end)

  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  const progressPercentage = totalDuration > 0 ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100) : 0

  const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const isNotOpen = startDate > now
  const isClosed = endDate < now
  const isOpen = !isNotOpen && !isClosed

  return (
    <div class="flex flex-col gap-1">
      <progress
        class="progress"
        classList={{
          'progress-warning': isNotOpen,
          'progress-info': isOpen,
          'progress-error': isClosed,
        }}
        value={progressPercentage}
        max={100}
      />
      <div class="flex justify-between items-center text-sm">
        <span class="font-medium">
          <Show when={isNotOpen}>
            {daysUntilStart > 0 ? t('D-{{days}}', { days: daysUntilStart }) : t('Opening soon')}
          </Show>
          <Show when={isOpen}>{daysUntilEnd > 0 ? t('D-{{days}}', { days: daysUntilEnd }) : t('Closes today')}</Show>
          <Show when={isClosed}>{t('Closed')}</Show>
        </span>
        <span class="text-neutral-500">
          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
