import {  useNavigate } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type AssignmentSpec, studioV1InlineSuggestions, studioV1SaveAssignment } from '@/api'
import { PreviewButton } from '@/routes/preview/-PreviewButton'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { AttachmentField, BooleanField, DataBindField, NumberField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { vAssignmentEditingSpec } from './data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Assignment = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { source, staging } = useEditing<AssignmentSpec>()

  const schema = vAssignmentEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()
  const [sampleFile, setSampleFile] = createSignal<File>()

  const saveAssignment = async (validated: v.InferOutput<typeof vAssignmentEditingSpec>) => {
    const { data: id } = await studioV1SaveAssignment({
      body: {
        data: { id: staging.id === EMPTY_CONTENT_ID ? undefined : staging.id, ...validated },
        thumbnail: thumbnail(),
        sampleAttachment: sampleFile(),
      },
    })
    setThumbnail(undefined)

    props.onSave(id)

    if (staging.id === EMPTY_CONTENT_ID) {
      navigate({ to: '/studio/$app/$id', params: { app: 'assignment', id }, replace: true })
    } else {
      modifyMutable(
        source,
        reconcile(
          structuredClone(unwrap({ ...staging, questions: source.questions, rubricCriteria: source.rubricCriteria })),
        ),
      )
    }
  }

  return (
    <DataAction
      rootKey={[]}
      excludeKeys={[['questions'], ['rubricCriteria']]}
      label={t('Assignment')}
      schema={vAssignmentEditingSpec}
    >
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

            <div class="grid grid-cols-3 gap-4">
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
              <NumberField
                path={['appealDeadlineDays']}
                label={t('Appeal deadline')}
                schema={schema.appealDeadlineDays}
              />
              <NumberField path={['confirmDueDays']} label={t('Confirm due days')} schema={schema.confirmDueDays} />
            </div>

            <div class="divider" />

            <AttachmentField
              path={['sampleAttachment']}
              label={t('Sample attachment')}
              onFileSelect={setSampleFile}
              required
            />

            <div class="divider" />

            <DataBindField<number, Parameters<typeof studioV1InlineSuggestions>[0]>
              path={['honorCodeId']}
              label={t('Honor code')}
              cacheKey="studioV1InlineSuggestions"
              fetchParams={() => ({ query: { kind: 'honor_code' } })}
              fetchFn={async (options) => (await studioV1InlineSuggestions(options)).data}
              schema={schema.honorCodeId}
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <PreviewButton
                  link={{ to: '/student/assignment/$id/session', params: { id: source.id } }}
                  modified={source.modified}
                  class="mr-auto"
                />
              </Show>

              <actions.Import />
              <actions.Export />
              <actions.Reset />
              <actions.Save onSave={saveAssignment} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
