import { batch, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type DiscussionSpec, studioV1DeleteDiscussionQuesion, studioV1SaveDiscussionQuestions } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, RichTextField, TextField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vDiscussionQuestionEditingSpec } from './data'

interface Props {
  index: number
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<DiscussionSpec>()

  const question = () => staging.questions[props.index]!

  const [files, setFiles] = createSignal<File[]>([])

  const saveQuestion = async (validated: v.InferOutput<typeof vDiscussionQuestionEditingSpec>) => {
    const { data } = await studioV1SaveDiscussionQuestions({
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

    await studioV1DeleteDiscussionQuesion({ path: { id: staging.id, question_id: questionId } })
    batch(() => {
      source.questions.splice(props.index, 1)
      staging.questions.splice(props.index, 1)
    })
    return props.index
  }

  return (
    <DataAction
      rootKey={['questions', props.index]}
      label={t('Discussion questions')}
      schema={vDiscussionQuestionEditingSpec}
    >
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper
            collapsed={!!source.questions[props.index]}
            fallback={<div class="line-clamp-1">{question().directive}</div>}
          >
            <TextField
              path={['questions', props.index, 'directive']}
              label={`${t('Directive')} ${props.index + 1}`}
              schema={vDiscussionQuestionEditingSpec.entries.directive}
              multiline
            />

            <RichTextField
              path={['questions', props.index, 'supplement']}
              label={t('Supplement')}
              schema={vDiscussionQuestionEditingSpec.entries.supplement}
              setFiles={setFiles}
            />

            <div class="divider" />

            <div class="grid grid-cols-3 gap-4">
              <NumberField
                path={['questions', props.index, 'postPoint']}
                label={t('Post point')}
                schema={vDiscussionQuestionEditingSpec.entries.postPoint}
              />
              <NumberField
                path={['questions', props.index, 'replyPoint']}
                label={t('Reply point')}
                schema={vDiscussionQuestionEditingSpec.entries.replyPoint}
              />
              <NumberField
                path={['questions', props.index, 'tutorAssessmentPoint']}
                label={t('Tutor assessment point')}
                schema={vDiscussionQuestionEditingSpec.entries.tutorAssessmentPoint}
              />
              <NumberField
                path={['questions', props.index, 'postMinCharacters']}
                label={t('Post minimum characters')}
                schema={vDiscussionQuestionEditingSpec.entries.postMinCharacters}
              />
              <NumberField
                path={['questions', props.index, 'replyMinCharacters']}
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
