import { createSignal, For, Match, Show, Switch } from 'solid-js'
import type { AppealSchema, ExamQuestionSchema } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { useTranslation } from '@/shared/solid/i18n'
import { WordFrequency } from '@/shared/WordFrequency'
import { Appeal } from '../../-shared/grading/Appeal'
import { useSession } from './context'

interface Props {
  question: ExamQuestionSchema
  numbering: number
}

export const QuestionReview = (props: Props) => {
  const { t } = useTranslation()

  const [session, { setStore }] = useSession()
  const s = () => session.data!

  const grade = s().grade!

  const question = props.question
  const questionId = String(props.question.id)
  const solution = s().solutions![questionId]
  const analysis = s().analysis![questionId]

  const answer = s().submission!.answers[questionId] ?? ''
  const feedback = s().grade!.feedback[questionId] ?? ''

  const onCreateAppeal = (appeal: AppealSchema) => {
    setStore('data', 'appeals', String(appeal.questionId), appeal)
  }

  const earnedPoint = grade.earnedDetails?.[questionId] ?? 0

  const [appealDialogOpen, setAppealDialogOpen] = createSignal(false)

  // reactive
  const appeal = () => s().appeals![questionId]

  return (
    <div class="px-6 py-4">
      <div class="label mb-4">{t('Question {{num}}', { num: props.numbering })}</div>
      <div class="space-y-4">
        <div class="space-y-6 mb-12">
          <h3 class="mb-6">{question.question}</h3>
          <Show when={question.supplement}>
            <ContentViewer content={question.supplement!} class="bg-base-content/5 rounded-box p-6" />
          </Show>
          <fieldset class="space-y-4" disabled>
            <Switch>
              <Match when={question.format === 'single_choice'}>
                <For each={question.options}>
                  {(option, i) => {
                    const correctAnswer = solution?.correctAnswers.includes(String(i() + 1))

                    const selectionData = s().analysis?.[questionId] ?? {}
                    const totalSubmissions = Object.values(selectionData).reduce((sum, count) => sum + count, 0)

                    const selectionRates =
                      totalSubmissions > 0
                        ? Object.fromEntries(
                            Object.entries(selectionData).map(([option, count]) => [
                              option,
                              Math.round((count / totalSubmissions) * 100),
                            ]),
                          )
                        : {}

                    return (
                      <div class="flex items-center gap-8">
                        <label class="label cursor-pointer flex gap-4 flex-1">
                          <input
                            type="radio"
                            checked={answer === String(i() + 1) || correctAnswer}
                            class="radio radio-sm"
                            classList={{ 'radio-primary': correctAnswer }}
                          />
                          <span class="flex-1 text-base" classList={{ 'text-primary': correctAnswer }}>
                            {option}
                          </span>
                        </label>

                        <Show when={totalSubmissions > 0}>
                          <div class="flex flex-col items-end gap-1">
                            <span class="text-xs label">{selectionRates[String(i() + 1)] ?? 0}%</span>
                            <progress
                              class="progress progress-accent w-24"
                              value={selectionRates[String(i() + 1)] ?? 0}
                              max="100"
                            ></progress>
                          </div>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </Match>
              <Match when={question.format === 'text_input'}>
                <input type="text" value={answer} class="input w-full" />
              </Match>
              <Match when={question.format === 'number_input'}>
                <input type="number" value={answer} class="input w-full" />
              </Match>
              <Match when={question.format === 'essay'}>
                <textarea value={answer} rows={5} class="textarea w-full field-sizing-content" />
              </Match>
            </Switch>
          </fieldset>

          {['text_input', 'essay'].includes(question.format) && (
            <div class="space-y-2">
              <div class="label text-sm">{t('Most frequestly used words in answers')}</div>
              <WordFrequency frequencies={analysis} />
            </div>
          )}
        </div>

        <Show
          when={
            appeal() ||
            (!grade.confirmed &&
              new Date(s().gradingDate.confirmDue) > new Date() &&
              (grade.earnedDetails?.[questionId] ?? 0) < (question.point ?? 0))
          }
        >
          <div class="text-right">
            <button type="button" class="badge badge-soft cursor-pointer" onClick={() => setAppealDialogOpen(true)}>
              {t('Grading Appeal')}
            </button>
          </div>
        </Show>

        <table class="table table-sm">
          <tbody class="[&_th]:whitespace-nowrap">
            <tr>
              <th>{t('Points')}</th>
              <td class="font-bold">
                <div
                  class="badge"
                  classList={{
                    'badge-primary': earnedPoint >= question.point!,
                    'badge-secondary': earnedPoint < question.point!,
                  }}
                >
                  {earnedPoint} / {question.point}
                </div>
              </td>
            </tr>
            <tr>
              <th>{t('Feedback')}</th>
              <td>{feedback}</td>
            </tr>
            <tr>
              <th>{t('Correct Answer')}</th>
              <td>{solution?.correctAnswers?.map((answer) => String(answer)).join(', ')}</td>
            </tr>
            <tr>
              <th>{t('Correct Criteria')}</th>
              <td>{solution?.correctCriteria}</td>
            </tr>
            <tr>
              <th>{t('Explanation')}</th>
              <td>{solution?.explanation}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog
        title={t(`Question ${props.numbering}.`)}
        boxClass="max-w-3xl"
        open={!!appealDialogOpen()}
        onClose={() => setAppealDialogOpen(false)}
      >
        <Appeal appeal={appeal()} appLabel="exam" model="question" questionId={question.id} onCreate={onCreateAppeal} />
      </Dialog>
    </div>
  )
}
