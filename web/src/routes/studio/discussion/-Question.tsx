import { batch, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type DiscussionSpec, studioV1DeleteDiscussionQuesion, studioV1SaveDiscussionQuestion } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vDiscussionQuestionEditingSpec } from './-data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<DiscussionSpec>()

  const question = () => staging.questionSet[props.index]!

  const [files, setFiles] = createSignal<File[]>([])

  const saveQuestion = async (validated: v.InferOutput<typeof vDiscussionQuestionEditingSpec>) => {
    if (!staging.id) {
      showToast({
        title: t('Save failed'),
        message: t('Please save the discussion first'),
        type: 'error',
        duration: 1000 * 3,
      })
      throw new Error('Please save the discussion first')
    }

    const { data } = await studioV1SaveDiscussionQuestion({
      path: { id: staging.id },
      body: { data: validated, files: files() },
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

    await studioV1DeleteDiscussionQuesion({ path: { id: staging.id, q: questionId } })
    batch(() => {
      source.questionSet.splice(props.index, 1)
      staging.questionSet.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction rootKey={['questionSet', props.index]} label={t('discussion-question')} schema={vDiscussionQuestionEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper collapsed={!!source.questionSet[props.index]} fallback={<div class="line-clamp-1">{question().directive}</div>}>
            <TextField
              path={['questionSet', props.index, 'directive']}
              label={`${t('Directive')} ${props.index + 1}`}
              schema={vDiscussionQuestionEditingSpec.entries.directive}
              multiline
            />

            <RichTextField
              path={['questionSet', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vDiscussionQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />

            <div class="divider" />

            <div class="grid grid-cols-3 gap-4">
              <NumberField
                path={['questionSet', props.index, 'postPoint']}
                label={t('Post point')}
                schema={vDiscussionQuestionEditingSpec.entries.postPoint}
              />
              <NumberField
                path={['questionSet', props.index, 'replyPoint']}
                label={t('Reply point')}
                schema={vDiscussionQuestionEditingSpec.entries.replyPoint}
              />
              <NumberField
                path={['questionSet', props.index, 'tutorAssessmentPoint']}
                label={t('Tutor assessment point')}
                schema={vDiscussionQuestionEditingSpec.entries.tutorAssessmentPoint}
              />
              <NumberField
                path={['questionSet', props.index, 'postMinCharacters']}
                label={t('Post minimum characters')}
                schema={vDiscussionQuestionEditingSpec.entries.postMinCharacters}
              />
              <NumberField
                path={['questionSet', props.index, 'replyMinCharacters']}
                label={t('Reply minimum characters')}
                schema={vDiscussionQuestionEditingSpec.entries.replyMinCharacters}
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
