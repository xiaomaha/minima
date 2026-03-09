import { For, Show } from 'solid-js'
import type { ExamQuestionSchema, ExamSolutionSchema } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { useTranslation } from '@/shared/solid/i18n'
import { WordFrequency } from '@/shared/WordFrequency'

interface Props {
  question: ExamQuestionSchema
  solution: ExamSolutionSchema | null
  analysis: Record<string, number> | undefined
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  return (
    <div class="space-y-6">
      <div class="space-y-6 mb-12">
        <h3 class="mb-6 text-base font-semibold">
          <div class="badge badge-xs badge-neutral block mb-2">{t('Question')}</div>
          {props.question.question}
        </h3>
        <Show when={props.question.supplement}>
          <ContentViewer content={props.question.supplement!} class="bg-base-content/5 rounded-box p-6" />
        </Show>
        <fieldset class="space-y-4" disabled>
          <Show when={props.question.format === 'single_choice'}>
            <For each={props.question.options}>
              {(option, i) => {
                const correctAnswer = props.solution?.correctAnswers.includes(String(i() + 1))
                const totalSubmissions = Object.values(props.analysis ?? {}).reduce((sum, count) => sum + count, 0)

                const selectionRates =
                  totalSubmissions > 0
                    ? Object.fromEntries(
                        Object.entries(props.analysis ?? {}).map(([option, count]) => [
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
                        checked={correctAnswer}
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
          </Show>
        </fieldset>

        {['text_input', 'essay'].includes(props.question.format) && (
          <div class="space-y-2">
            <div class="label text-sm">{t('Most frequestly used words in answers')}</div>
            <WordFrequency frequencies={props.analysis ?? {}} />
          </div>
        )}
      </div>

      <div class="divider" />

      <table class="table table-sm">
        <tbody class="[&_th]:whitespace-nowrap [&_th]:font-normal">
          <tr>
            <th>{t('Possible Points')}</th>
            <td>{props.question.point}</td>
          </tr>
          <Show when={props.solution?.correctAnswers.filter((v) => v).length}>
            <tr>
              <th>{t('Correct Answer')}</th>
              <td>{props.solution?.correctAnswers?.map((answer) => String(answer)).join(', ')}</td>
            </tr>
          </Show>
          <tr>
            <th>{t('Correct Criteria')}</th>
            <td>{props.solution?.correctCriteria}</td>
          </tr>
          <tr>
            <th>{t('Explanation')}</th>
            <td>{props.solution?.explanation}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
