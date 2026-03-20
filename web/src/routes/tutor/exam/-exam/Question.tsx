import { IconRefresh } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import { type ExamQuestionSchema, type ExamSolutionSchema, tutorV1RegradeExamQuestion } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { WordFrequency } from '@/shared/WordFrequency'

interface Props {
  examId: string
  question: ExamQuestionSchema
  solution: ExamSolutionSchema | null
  analysis: Record<string, number> | undefined
  refetch: () => void
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

      <table class="table">
        <tbody class="[&_th]:whitespace-nowrap [&_th]:font-normal">
          <tr>
            <th>{t('Possible Points')}</th>
            <td>{props.question.point}</td>
          </tr>
          <Show when={props.solution?.correctAnswers.filter((v) => v).length}>
            <tr>
              <th>{t('Correct Answer')}</th>
              <td class="flex gap-2 items-center">
                <span class="mr-8">{props.solution!.correctAnswers.map((answer) => String(answer)).join(', ')}</span>
                <ReGrader
                  examId={props.examId}
                  questionId={props.question.id}
                  fromAnswers={props.solution!.correctAnswers}
                  format={props.question.format}
                  min={props.question.format === 'single_choice' ? 1 : 0}
                  max={props.question.format === 'single_choice' ? props.question.options.length : 0}
                  refetch={props.refetch}
                />
              </td>
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

interface ReGraderProps {
  examId: string
  questionId: number
  fromAnswers: string[]
  format: string
  min: number
  max: number
  refetch: () => void
}

const ReGrader = (props: ReGraderProps) => {
  const { t } = useTranslation()

  const [formState, { Form, Field, reset, getValue }] = createForm({
    initialValues: { toAnswers: props.fromAnswers.join(', ') },
  })

  const submit = async (values: { toAnswers: string }) => {
    const answers = values.toAnswers.split(',').map((v) => v.trim())
    await tutorV1RegradeExamQuestion({
      path: { id: props.examId, question_id: props.questionId },
      body: { toAnswers: answers },
    })

    reset({ initialValues: { toAnswers: answers.join(', ') } })
    setResetValue(answers.join(', '))

    showToast({
      title: t('Correct answers updated successfully'),
      message: t(
        'All submissions are being re-graded. ' +
          'This may take a moment — please click the refresh button at the top of the page shortly to see the updated results.',
      ),
      type: 'info',
      duration: 1000 * 5,
    })
  }

  const format = props.format
  const min = props.min
  const max = props.max

  const [resetValue, setResetValue] = createSignal(props.fromAnswers.join(', '))
  const isTrimmedDirty = () => {
    const valueSet = new Set(
      getValue('toAnswers')
        .split(',')
        .map((v) => v.trim()),
    )
    const draftSet = new Set(
      resetValue()
        .split(',')
        .map((v) => v.trim()),
    )
    return valueSet.size !== draftSet.size || [...valueSet].some((v) => !draftSet.has(v))
  }

  return (
    <Form onSubmit={submit}>
      <Field
        name="toAnswers"
        validate={(v) => {
          if (v.trim().length === 0) return t('Answers are required')
          if (format === 'single_choice') {
            for (const answer of v.split(',')) {
              if (Number.isNaN(Number(answer))) return t('Answers must be numbers')
              if (Number(answer) < min) {
                return t('Answers must be greater than {{count}}', { count: min })
              }
              if (Number(answer) > max) {
                return t('Answers must be less than {{count}}', { count: max })
              }
            }
          }
          return ''
        }}
      >
        {(field, fieldProps) => (
          <div class="flex flex-1 gap-2 items-center">
            <input
              {...fieldProps}
              value={field.value ?? ''}
              class="input max-w-40 bg-amber-100 border-0 validator"
              required
            />
            <SubmitButton
              label={t('Update correct answers')}
              isPending={formState.submitting}
              disabled={!isTrimmedDirty()}
              class="btn btn-primary min-w-48"
            />
            <Show when={field.error} fallback={<div class="label">{t('Comman separated answers. ex) 1, 4')}</div>}>
              <div class="text-error">{field.error}</div>
            </Show>
            <button type="button" class="btn btn-circle btn-ghost text-primary" onClick={() => props.refetch()}>
              <IconRefresh size={20} />
            </button>
          </div>
        )}
      </Field>
    </Form>
  )
}
