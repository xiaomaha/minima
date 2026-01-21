import { createSignal, Match, Show, Switch } from 'solid-js'
import type { ExamQuestionSchema } from '@/api'
import { Dialog } from '@/shared/Diaglog'
import { useTranslation } from '@/shared/solid/i18n'
import { ScorePanel } from '../../-shared/grading/ScorePanel'
import { useSession } from './context'
import { QuestionReview } from './QuestionReview'

interface SelectedQuestion {
  question: ExamQuestionSchema
  numbering: number
}

export const GradingReview = () => {
  const { t } = useTranslation()
  const [selectedQuestion, setSelectedQuestion] = createSignal<SelectedQuestion | null>(null)

  const [session] = useSession()
  const s = () => session.data!

  const exam = s().exam
  const attempt = s().attempt!
  const grade = s().grade!
  const solutions = s().solutions!
  const analysis = s().analysis!

  const passingPoint = exam.passingPoint ?? 0

  return (
    <>
      <div class="w-full space-y-12">
        <ScorePanel grade={grade} passingPoint={passingPoint} />

        <div class="overflow-x-auto">
          <div class="label my-1 text-sm">{t('Question Breakdown')}</div>
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Question')}</th>
                <th class="text-center">{t('Accuracy Rate')}</th>
                <th class="text-center">{t('Points')}</th>
                <th class="text-center">{t('Appeal')}</th>
              </tr>
            </thead>
            <tbody>
              {attempt.questions.map((question, i) => {
                const questionId = String(question.id)
                const earned = grade.earnedDetails?.[questionId] ?? 0
                const isCorrect = earned >= question.point!

                const questionAnalysis = analysis[questionId] ?? {}
                const submissionCount = Object.values(questionAnalysis).reduce((acc, count) => acc + count, 0)

                const correctAnswersSet = new Set(solutions[questionId]?.correctAnswers)
                const correctCount = Object.entries(questionAnalysis)
                  .filter(([option]) => correctAnswersSet.has(option))
                  .reduce((sum, [_, count]) => sum + count, 0)

                const accuracyRate =
                  question.format === 'single_choice' && submissionCount > 0
                    ? `${Math.round((correctCount / submissionCount) * 100)}%`
                    : '-'

                // reactive
                const appeal = () => s().appeals![questionId]

                return (
                  <tr
                    onClick={() => setSelectedQuestion({ question, numbering: i + 1 })}
                    class="hover:bg-base-200 cursor-pointer"
                  >
                    <td>{i + 1}</td>
                    <td>
                      <span class="line-clamp-1">{question.question}</span>
                    </td>
                    <td class="text-center">{accuracyRate}</td>
                    <td class="text-center whitespace-nowrap">
                      {earned} / {question.point}
                    </td>
                    <td class="text-center">
                      <Switch>
                        <Match when={appeal()}>
                          <span
                            class="badge badge-sm"
                            classList={{
                              'badge-soft': !!appeal()!.closed,
                              'badge-warning': !appeal()!.closed,
                            }}
                          >
                            {appeal()!.closed ? t('Reviewed') : t('Pending')}
                          </span>
                        </Match>
                        <Match
                          when={!isCorrect && new Date(s().gradingDate.confirmDue) > new Date() && !grade.confirmed}
                        >
                          <span class="badge badge-sm badge-error badge-outline">{t('Available')}</span>
                        </Match>
                      </Switch>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog boxClass="max-w-4xl" open={!!selectedQuestion()} onClose={() => setSelectedQuestion(null)}>
        <Show when={selectedQuestion()}>
          <QuestionReview question={selectedQuestion()!.question} numbering={selectedQuestion()!.numbering} />
        </Show>
      </Dialog>
    </>
  )
}
