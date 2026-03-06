import { batch, createSignal, For, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type SurveySpec, studioV1DeleteSurveyQuesion, studioV1SaveSurveyQuestions } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vSurveyQuestionEditingSpec } from './data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<SurveySpec>()

  const question = () => staging.questions[props.index]!

  const [files, setFiles] = createSignal<File[]>([])

  const saveQuestion = async (validated: v.InferOutput<typeof vSurveyQuestionEditingSpec>) => {
    const { data } = await studioV1SaveSurveyQuestions({
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

    await studioV1DeleteSurveyQuesion({ path: { id: staging.id, question_id: questionId } })
    batch(() => {
      source.questions.splice(props.index, 1)
      staging.questions.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction rootKey={['questions', props.index]} label={t('Survey questions')} schema={vSurveyQuestionEditingSpec}>
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
              label={`${t('Question')} ${props.index + 1} - ${t(question().format)}`}
              schema={vSurveyQuestionEditingSpec.entries.question}
              multiline
            />

            <RichTextField
              path={['questions', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vSurveyQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />

            <Show when={question().format === 'single_choice'}>
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
            </Show>

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <actions.Remove onRemove={removeQuestion} />
              <actions.Import />
              <actions.Export />
              <actions.Reset />
              <actions.Save label={t('Save')} onSave={saveQuestion} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
