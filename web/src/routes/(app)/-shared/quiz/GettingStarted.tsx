import { createSignal, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { type LearningSessionStep, type QuizSessionSchema, quizV1StartAttempt } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { useTranslation } from '@/shared/solid/i18n'

const SITTING = 1 as LearningSessionStep

interface Props {
  session: QuizSessionSchema
  setStore: SetStoreFunction<{ data: QuizSessionSchema | undefined }>
  inlineContext?: { media: string } //  inline quiz inside media
  mode?: string
}

export const GettingStarted = (props: Props) => {
  const { t } = useTranslation()
  const session = props.session

  const [loading, setLoading] = createSignal(false)
  const start = async () => {
    setLoading(true)
    const { data } = await quizV1StartAttempt({
      path: { id: session.quiz.id },
      query: { ...props.inlineContext, mode: props.mode },
    })
    props.setStore('data', (prev) => prev && { ...prev, step: SITTING, attempt: data })
    setLoading(false)
  }

  return (
    <div class="flex flex-col gap-4 p-8 m-auto items-center">
      <div class="text-xl font-semibold">{session.quiz.title}</div>
      <Show when={session.quiz.description}>
        <ContentViewer content={session.quiz.description!} class="text-sm my-2 w-full" />
      </Show>

      <button type="button" class="my-4 btn btn-primary min-w-40" onClick={start} disabled={loading()}>
        {t('Start Quiz')}
      </button>

      <div class="rounded-box border border-base-content/5 bg-base-100 max-w-140 w-full">
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
  )
}
