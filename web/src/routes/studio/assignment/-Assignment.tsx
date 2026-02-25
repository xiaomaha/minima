import { IconExternalLink } from '@tabler/icons-solidjs'
import { batch, createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type AssignmentSpec, studioV1SaveAssignment } from '@/api'
import { initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, NumberField, RichTextField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { EmptyAssignment, vAssignmentEditingSpec } from './-data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Assignment = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<AssignmentSpec>()

  const schema = vAssignmentEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveAssignment = async (validated: v.InferOutput<typeof vAssignmentEditingSpec>) => {
    const { data } = await studioV1SaveAssignment({ body: { data: { id: staging.id, ...validated }, thumbnail: thumbnail() } })
    setThumbnail(undefined)

    // save without question set
    const editingQuestionSet = structuredClone(unwrap(staging.questionSet))

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore(
          'studioV1GetAssignment',
          { path: { id: data } },
          structuredClone(unwrap({ ...staging, id: data, questionSet: [] })),
        )
        modifyMutable(staging, reconcile(structuredClone(EmptyAssignment())))
      })
      // after onSave
      queueMicrotask(() => (staging.questionSet = editingQuestionSet))
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, questionSet: source.questionSet }))))
    }

    props.onSave(data)
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['questionSet']]} label={t('Assignment')} schema={vAssignmentEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{source.title}</div>}>
            <TextField path={['title']} label={t('Title')} schema={schema.title} class="text-2xl font-semibold" />
            <TextField path={['description']} label={t('Description')} schema={schema.description} multiline />
            <TextField path={['audience']} label={t('Audience')} schema={schema.audience} multiline />

            <ThumbnailField path={['thumbnail']} label={t('Thumbnail')} onFileSelect={setThumbnail} required />

            <div class="flex gap-4">
              <BooleanField path={['featured']} label={t('Featured')} schema={schema.featured} />
              <BooleanField
                path={['verificationRequired']}
                label={t('Verification required')}
                schema={schema.verificationRequired}
              />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
              <NumberField path={['maxAttempts']} label={t('Max attempts')} schema={schema.maxAttempts} />
              <NumberField path={['gradeDueDays']} label={t('Grade due days')} schema={schema.gradeDueDays} />
              <NumberField path={['appealDeadlineDays']} label={t('Appeal deadline')} schema={schema.appealDeadlineDays} />
              <NumberField path={['confirmDueDays']} label={t('Confirm due days')} schema={schema.confirmDueDays} />
            </div>

            <div class="divider" />

            <TextField path={['honorCode', 'title']} label={t('Honor code title')} schema={schema.honorCode.entries.title} />
            <RichTextField path={['honorCode', 'code']} label={t('Honor code content')} schema={schema.honorCode.entries.code} />

            <div class="divider" />

            <TextField
              path={['questionPool', 'description']}
              label={t('Question pool description')}
              schema={schema.questionPool.entries.description}
              multiline
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <a
                  href={`/assignment/${source.id}/session?mode=preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-primary btn-sm btn-link mr-auto no-underline"
                  onMouseDown={(e) => e.preventDefault()}
                  tabIndex={-1}
                >
                  <IconExternalLink size={20} />
                  {t('Preview')}
                  <span class="text-base-content/40">{new Date(source.modified).toLocaleString()}</span>
                </a>
              </Show>

              <actions.Import />
              <actions.Export />
              <actions.Reset />

              <fieldset disabled={false}>
                <actions.Save onSave={saveAssignment} />
              </fieldset>
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
