import { useTransContext } from '@mbarzda/solid-i18next'
import type { AssignmentGradeSchema, DiscussionGradeSchema, ExamGradeSchema } from '@/api'

interface Props {
  grade: AssignmentGradeSchema | ExamGradeSchema | DiscussionGradeSchema
  passingScore: number
  compact?: boolean
}

export const ScorePanel = (props: Props) => {
  const [t] = useTransContext()

  const grade = props.grade

  return (
    <>
      <div class="label my-1 text-sm">{t('My score')}</div>
      <div class="stats shadow mx-auto w-full">
        <div class="stat place-items-center">
          <div class="stat-title">{t('Earned Points')}</div>
          <div class="stat-value font-semibold">
            {grade.earnedPoint} / {grade.possiblePoint}
          </div>
          <div class="stat-desc"></div>
        </div>
        <div class="stat place-items-center">
          <div class="stat-title">{t('Standard Score')}</div>
          <div
            class="stat-value text-5xl py-2 text-primary"
            classList={{ 'text-5xl': !props.compact, 'text-3xl': props.compact }}
          >
            {t('{{count}} point', { count: Number(grade.score.toFixed(1)) })}
          </div>
          <div class="stat-desc" classList={{ 'text-error': !grade.confirmed }}>
            {grade.confirmed ? t('Final Score') : t('Provisional Score')}
          </div>
        </div>
        <div class="stat place-items-center">
          <div class="stat-title">{t('Passing Score')}</div>
          <div class="stat-value font-semibold">{props.passingScore}</div>
          <div class="stat-desc"></div>
        </div>
      </div>
    </>
  )
}
