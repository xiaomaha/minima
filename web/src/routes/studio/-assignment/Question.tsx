import { batch, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type AssignmentSpec, studioV1DeleteAssignmentQuesion, studioV1SaveAssignmentQuestions } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { CommaSeparatedField, NumberField, RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vAssignmentQuestionEditingSpec } from './data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<AssignmentSpec>()

  const question = () => staging.questions[props.index]!

  const [files, setFiles] = createSignal<File[]>([])

  const saveQuestion = async (validated: v.InferOutput<typeof vAssignmentQuestionEditingSpec>) => {
    const { data } = await studioV1SaveAssignmentQuestions({
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

    await studioV1DeleteAssignmentQuesion({ path: { id: staging.id, question_id: questionId } })
    batch(() => {
      source.questions.splice(props.index, 1)
      staging.questions.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction
      rootKey={['questions', props.index]}
      label={'Assignment question'}
      schema={vAssignmentQuestionEditingSpec}
    >
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
              schema={vAssignmentQuestionEditingSpec.entries.question}
              multiline
            />
            <RichTextField
              path={['questions', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vAssignmentQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />
            <div class="grid grid-cols-3 gap-4">
              <NumberField
                path={['questions', props.index, 'attachmentFileCount']}
                label={t('Attachment file count')}
                schema={vAssignmentQuestionEditingSpec.entries.attachmentFileCount}
              />
              <NumberField
                path={['questions', props.index, 'plagiarismThreshold']}
                label={t('Plagiarism threshold')}
                schema={vAssignmentQuestionEditingSpec.entries.plagiarismThreshold}
              />
              <CommaSeparatedField
                path={['questions', props.index, 'attachmentFileTypes']}
                label={t('Attachment file types')}
                schema={v.pipe(v.string(), v.minLength(1, t('comma separated characters')))}
              />
            </div>

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
