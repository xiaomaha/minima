import { IconExternalLink } from '@tabler/icons-solidjs'
import { batch, createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type SurveySpec, studioV1SaveSurvey } from '@/api'
import { initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, RichTextField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { EmptySurvey, vSurveyEditingSpec } from './-data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Survey = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<SurveySpec>()

  const schema = vSurveyEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveSurvey = async (validated: v.InferOutput<typeof vSurveyEditingSpec>) => {
    const { data } = await studioV1SaveSurvey({ body: { data: { id: staging.id, ...validated }, thumbnail: thumbnail() } })
    setThumbnail(undefined)

    // save without question set
    const editingQuestionSet = structuredClone(unwrap(staging.questionSet))

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore(
          'studioV1GetSurvey',
          { path: { id: data } },
          structuredClone(unwrap({ ...staging, id: data, questionSet: [] })),
        )
        modifyMutable(staging, reconcile(structuredClone(EmptySurvey())))
      })
      // after onSave
      queueMicrotask(() => (staging.questionSet = editingQuestionSet))
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, questionSet: source.questionSet }))))
    }

    props.onSave(data)
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['questionSet']]} label={t('Survey')} schema={vSurveyEditingSpec}>
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
              <BooleanField path={['anonymous']} label={t('Anonymous')} schema={schema.anonymous} />
              <BooleanField path={['showResults']} label={t('Show results')} schema={schema.showResults} />
            </div>

            <RichTextField path={['completeMessage']} label={t('Complete message')} schema={schema.completeMessage} />

            <div class="divider" />

            <TextField
              path={['questionPool', 'description']}
              label={t('Survey question pool description')}
              schema={schema.questionPool.entries.description}
              multiline
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <a
                  href={`/survey/${source.id}`}
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
                <actions.Save onSave={saveSurvey} />
              </fieldset>
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
