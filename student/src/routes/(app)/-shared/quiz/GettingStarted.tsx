import { createSignal } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { type LearningSessionStep, type QuizSessionSchema, quizV1StartAttempt } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'

const SITTING = 1 as LearningSessionStep

interface Props {
  session: QuizSessionSchema
  setStore: SetStoreFunction<{ data: QuizSessionSchema | undefined }>
}

export const GettingStarted = (props: Props) => {
  const { t } = useTranslation()
  const session = props.session

  const [loading, setLoading] = createSignal(false)
  const start = async () => {
    setLoading(true)
    const { data } = await quizV1StartAttempt({ path: { id: session.quiz.id } })
    props.setStore('data', (prev) => prev && { ...prev, step: SITTING, attempt: data })
    setLoading(false)
  }

  return (
    <div class="flex flex-col gap-4 p-8 h-full m-auto items-center">
      <div class="text-xl font-semibold">{session.quiz.title}</div>
      <div class="text-sm text-base-content/60">{session.quiz.description}</div>

      <button type="button" class="my-8 btn btn-primary min-w-40" onClick={start} disabled={loading()}>
        {t('Start Quiz')}
      </button>

      <div class="flex gap-4">
        <div class="rounded-box border border-base-content/5 bg-base-100">
          <table class="table table-sm w-full max-w-150 [&_tr>td:first-child]:whitespace-nowrap text-base-content/60">
            <tbody>
              <tr>
                <td>{t('Audience')}</td>
                <td>{session.quiz.audience}</td>
              </tr>
              <tr>
                <td>{t('Question Count')}</td>
                <td>{session.quiz.questionCount}</td>
              </tr>
              <tr>
                <td>{t('Passing Point')}</td>
                <td>{session.quiz.passingPoint} %</td>
              </tr>
              <tr>
                <td>{t('Max Attempts')}</td>
                <td>{session.quiz.maxAttempts || t('Unlimited')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
