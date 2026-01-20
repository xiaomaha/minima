import { useTransContext } from '@mbarzda/solid-i18next'
import { For, Show } from 'solid-js'
import type { AssignmentSessionSchema, DiscussionSessionSchema, ExamSessionSchema, QuizSessionSchema } from '@/api'
import { ScorePanel } from './ScorePanel'

interface Props {
  session: ExamSessionSchema | AssignmentSessionSchema | DiscussionSessionSchema | QuizSessionSchema
  passingPoint: number
  compact?: boolean
}

export const FinalScore = ({ session, passingPoint, compact = false }: Props) => {
  const [t] = useTransContext()

  const grade = session.grade!
  const stats = session.stats!

  const score = grade.score ?? 0
  const passed = grade.passed ?? false

  return (
    <div class="w-full" classList={{ 'space-y-16': !compact, 'space-y-6': compact }}>
      <div class="space-y-4">
        <ScorePanel grade={grade} passingScore={passingPoint} compact={compact} />
        <div class="flex justify-center items-center gap-4">
          <span class="text-sm label">{new Date(grade.confirmed!).toLocaleString()}</span>
          <div
            class="badge block"
            classList={{
              'badge-xl': !compact,
              'badge-lg': compact,
              'badge-success': passed,
              'badge-secondary': !passed,
            }}
          >
            {passed ? t('Passed') : t('Failed')}
          </div>
        </div>
      </div>

      <div class="relative w-full">
        <div class="label my-1 text-sm">{t('Statistics')}</div>
        <div class="stats mx-auto w-full" classList={{ 'stats-vertical lg:stats-horizontal': compact }}>
          <div class="stat place-items-center">
            <div class="stat-title" classList={{ 'text-xs': compact }}>
              {t('Total Students')}
            </div>
            <div class="stat-value font-semibold" classList={{ 'text-2xl': compact }}>
              {t('{{count}} person', { count: stats.total })}
            </div>
          </div>
          <div class="stat place-items-center">
            <div class="stat-title" classList={{ 'text-xs': compact }}>
              {t('Average Score')}
            </div>
            <div class="stat-value font-semibold" classList={{ 'text-2xl': compact }}>
              {t('{{count}} point', { count: Number(stats.avgScore.toFixed(1)) })}
            </div>
          </div>
          <div class="stat place-items-center">
            <div class="stat-title" classList={{ 'text-xs': compact }}>
              {t('Highest Score')}
            </div>
            <div class="stat-value font-semibold" classList={{ 'text-2xl': compact }}>
              {t('{{count}} point', { count: Number(stats.maxScore.toFixed(1)) })}
            </div>
          </div>
          <div class="stat place-items-center">
            <div class="stat-title" classList={{ 'text-xs': compact }}>
              {t('Lowest Score')}
            </div>
            <div class="stat-value font-semibold" classList={{ 'text-2xl': compact }}>
              {t('{{count}} point', { count: Number(stats.minScore.toFixed(1)) })}
            </div>
          </div>
        </div>
      </div>

      <Show when={!compact}>
        <hr class="border-base-content/10" />

        <div class="space-y-4">
          <div>
            <div class="label my-1 text-sm">{t('Score Distribution')}</div>
          </div>
          <div class="pt-8 pb-4 contents-box">
            <div class="flex h-50 items-end">
              <For each={Array.from({ length: 21 }, (_, i) => i * 5)}>
                {(bucket) => {
                  const distributionMap = Object.fromEntries(stats.distribution)
                  const count = distributionMap[bucket] ?? 0
                  const isMyRange = bucket <= score && score < bucket + 5
                  const heightPixels = stats.maxCount > 0 ? (count / stats.maxCount) * 200 : 0
                  const rangeText = bucket === 100 ? '100' : `${bucket}-${bucket + 4}`

                  return (
                    <div class="flex flex-col items-center gap-1 flex-1 tooltip" data-tip={rangeText}>
                      <div
                        class="relative w-[70%] rounded-t"
                        classList={{ 'bg-primary': isMyRange, 'bg-base-300': !isMyRange }}
                        style={{
                          height: count > 0 ? `${Math.max(heightPixels, 20)}px` : '0px',
                        }}
                      >
                        <Show when={count > 0}>
                          <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold">{count}</span>
                        </Show>
                        <Show when={isMyRange}>
                          <div class="badge badge-xs badge-info absolute -top-12 left-1/2 -translate-x-1/2">
                            {t('You')}
                          </div>
                        </Show>
                      </div>
                      <span class="text-[10px] font-mono mt-1">{bucket}</span>
                    </div>
                  )
                }}
              </For>
            </div>
            <div class="divider my-4" />
            <div class="flex justify-between text-xs text-base-content/60">
              <span>{t('Y-axis: Number of Students')}</span>
              <span>{t('X-axis: Score Distribution')}</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
