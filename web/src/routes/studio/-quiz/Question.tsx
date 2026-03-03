import { batch, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type QuizSpec, studioV1DeleteQuizQuesion, studioV1SaveQuizQuestions } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { CommaSeparatedField, NumberField, RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vQuizQuestionEditingSpec } from './data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<QuizSpec>()

  const question = () => staging.questions[props.index]!

  const [files, setFiles] = createSignal<File[]>([])

  const saveQuestion = async (validated: v.InferOutput<typeof vQuizQuestionEditingSpec>) => {
    const { data } = await studioV1SaveQuizQuestions({
      path: { id: staging.id },
      body: { data: { data: [validated] }, files: files() },
    })

    batch(() => {
      staging.questions[props.index]!.id = data[0]!
      source.questions[props.index] = structuredClone(unwrap(staging.questions[props.index]!))
    })
  }

  const removeQuestion = async () => {
    const questionId = question()!.id

    if (!questionId) {
      staging.questions.splice(props.index, 1)
      return props.index
    }

    if (!confirm(t('Are you sure you want to remove this question?'))) return

    await studioV1DeleteQuizQuesion({ path: { id: staging.id, question_id: questionId } })
    batch(() => {
      source.questions.splice(props.index, 1)
      staging.questions.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction rootKey={['questions', props.index]} label={t('Quiz questions')} schema={vQuizQuestionEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper
            collapsed={!!source.questions[props.index]}
            fallback={<div class="line-clamp-1">{question().question}</div>}
          >
            <TextField
              path={['questions', props.index, 'question']}
              label={`${t('Question')} ${props.index + 1}`}
              schema={vQuizQuestionEditingSpec.entries.question}
              multiline
            />

            <RichTextField
              path={['questions', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vQuizQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />

            <NumberField
              path={['questions', props.index, 'point']}
              label={t('Point')}
              schema={vQuizQuestionEditingSpec.entries.point}
            />

            <div class="divider" />

            <div class="flex-1 space-y-6 shrink">
              <For each={[0, 1, 2, 3, 4]}>
                {(_, index) => (
                  <TextField
                    path={['questions', props.index, 'options', index()]}
                    label={`${t('Option {{num}}', { num: index() + 1 })} ${index() > 1 ? t('Optional') : ''}`}
                    schema={index() < 2 ? v.pipe(v.string(), v.nonEmpty(t('required'))) : v.string()}
                    multiline
                  />
                )}
              </For>
            </div>

            <div class="divider" />

            <CommaSeparatedField
              path={['questions', props.index, 'solution', 'correctAnswers']}
              label={t('Correct answer')}
              schema={v.pipe(v.string(), v.minLength(1, t('comma separated characters')))}
            />

            <TextField
              path={['questions', props.index, 'solution', 'explanation']}
              label={t('Explanation')}
              schema={vQuizQuestionEditingSpec.entries.solution.entries.explanation}
              multiline
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <actions.Remove onRemove={removeQuestion} />
              <actions.Import label="" />
              <actions.Export label="" />
              <actions.Reset label="" />
              <actions.Save label={t('Save')} onSave={saveQuestion} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
