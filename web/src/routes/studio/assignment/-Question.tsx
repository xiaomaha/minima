import { batch, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type AssignmentSpec, studioV1DeleteAssignmentQuesion, studioV1SaveAssignmentQuestion } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { AttachmentField, CommaSeparatedField, NumberField, RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vAssignmentQuestionEditingSpec } from './-data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<AssignmentSpec>()

  const question = () => staging.questionSet[props.index]!

  const [files, setFiles] = createSignal<File[]>([])
  const [sampleFile, setSampleFile] = createSignal<File>()

  const saveQuestion = async (validated: v.InferOutput<typeof vAssignmentQuestionEditingSpec>) => {
    if (!staging.id) {
      showToast({
        title: t('Save failed'),
        message: t('Please save the assignment first'),
        type: 'error',
        duration: 1000 * 3,
      })
      throw new Error('Please save the assignment first')
    }

    const { data } = await studioV1SaveAssignmentQuestion({
      path: { id: staging.id },
      body: { data: validated, files: files(), sample: sampleFile() },
    })

    batch(() => {
      staging.questionSet[props.index]!.id = data
      source.questionSet[props.index] = structuredClone(unwrap(staging.questionSet[props.index]!))
    })
  }

  const removeQuestion = async () => {
    const questionId = question()!.id

    if (questionId <= 0) {
      staging.questionSet.splice(props.index, 1)
      return props.index
    }

    if (!confirm(t('Are you sure you want to remove this question?'))) return

    await studioV1DeleteAssignmentQuesion({ path: { id: staging.id, q: questionId } })
    batch(() => {
      source.questionSet.splice(props.index, 1)
      staging.questionSet.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction rootKey={['questionSet', props.index]} label={t('assignment-question')} schema={vAssignmentQuestionEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper collapsed={!!source.questionSet[props.index]} fallback={<div class="line-clamp-1">{question().question}</div>}>
            <TextField
              path={['questionSet', props.index, 'question']}
              label={`${t('Question')} ${props.index + 1}`}
              schema={vAssignmentQuestionEditingSpec.entries.question}
              multiline
            />
            <RichTextField
              path={['questionSet', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vAssignmentQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />
            <div class="grid grid-cols-3 gap-4">
              <NumberField
                path={['questionSet', props.index, 'attachmentFileCount']}
                label={t('Attachment file count')}
                schema={vAssignmentQuestionEditingSpec.entries.attachmentFileCount}
              />
              <NumberField
                path={['questionSet', props.index, 'plagiarismThreshold']}
                label={t('Plagiarism threshold')}
                schema={vAssignmentQuestionEditingSpec.entries.plagiarismThreshold}
              />
              <CommaSeparatedField
                path={['questionSet', props.index, 'attachmentFileTypes']}
                label={t('Attachment file types')}
                schema={v.pipe(v.string(), v.minLength(1, t('comma separated characters')))}
              />
            </div>

            <AttachmentField
              path={['questionSet', props.index, 'sampleAttachment']}
              label={t('Sample attachment')}
              onFileSelect={setSampleFile}
              required
            />

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
