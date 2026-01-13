import { useTransContext } from '@mbarzda/solid-i18next'
import { IconHelpCircle } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import { capitalize, toYYYYMMDD } from '@/shared/utils'
import { getAverageProgress, getProgress } from '../../-shared/record'
import { useSession } from './context'

export const Outline = () => {
  const [t] = useTransContext()
  const navigate = useNavigate()

  const [session] = useSession()
  const s = () => session.data!

  const gradebook = s().engagement?.gradebook
  const passingScore = s().course.passingPoint || 0
  const passingProgressRate = s().course.gradingCriteria.find((p) => p.model === 'completion')?.passingPoint
  const now = new Date()

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
          <div class="stat-desc">{t('Passing score: {{num}}', { num: passingScore })}</div>
        </div>
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
            <For each={s().course.lessons}>
              {(lesson, i) => {
                const startDate = new Date(lesson.startDate!)
                const endDate = new Date(lesson.endDate!)
                const notOpen = startDate > now

                return (
                  <tr>
                    <td>{i() + 1}</td>
                    <td>{lesson.title}</td>
                    <td class="whitespace-nowrap">
                      {toYYYYMMDD(startDate)} - {toYYYYMMDD(endDate)}
                    </td>
                    <td>
                      <progress
                        class="progress progress-primary"
                        // TODO: check lesson passed logic
                        value={getAverageProgress(
                          lesson.medias.map((m) => m.id),
                          `course=${s().course.id}`,
                        )}
                        max={100}
                      ></progress>
                    </td>

                    <Show when={s().engagement}>
                      <td class="py-0.5">
                        <div class="flex flex-col gap-1">
                          {lesson.medias.map((media) => (
                            <button
                              type="button"
                              disabled={notOpen}
                              class="btn btn-primary btn-sm whitespace-nowrap"
                              onClick={() =>
                                navigate({
                                  to: `/media/${media.id}`,
                                  search: { course: s().course.id },
                                })
                              }
                            >
                              {t(capitalize(media.format))}
                            </button>
                          ))}
                        </div>
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
