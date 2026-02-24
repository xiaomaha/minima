import { IconExternalLink } from '@tabler/icons-solidjs'
import { batch, createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type MediaSpec, studioV1SaveMedia } from '@/api'
import { initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, CommaSeparatedField, NumberField, SelectField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { EmptyMedia, mediaFormatOptions, vMediaEditingSpec } from './-data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Media = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<MediaSpec>()

  const schema = vMediaEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveMedia = async (validated: v.InferOutput<typeof vMediaEditingSpec>) => {
    const { data } = await studioV1SaveMedia({ body: { data: { id: staging.id, ...validated }, thumbnail: thumbnail() } })
    setThumbnail(undefined)

    // save without subtitle set
    const editingSubtitleSet = structuredClone(unwrap(staging.subtitleSet))

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore(
          'studioV1GetMedia',
          { path: { id: data } },
          structuredClone(unwrap({ ...staging, id: data, subtitleSet: [] })),
        )
        modifyMutable(staging, reconcile(structuredClone(EmptyMedia())))
      })
      // after onSave
      queueMicrotask(() => (staging.subtitleSet = editingSubtitleSet))
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, subtitleSet: source.subtitleSet }))))
    }
    props.onSave(data)
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['subtitleSet']]} label={t('Media')} schema={vMediaEditingSpec}>
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

            <div class="flex gap-4 items-center">
              <div class="max-w-40 w-full self-start">
                <SelectField path={['format']} label={t('Format')} schema={schema.format} options={mediaFormatOptions} />
              </div>

              <TextField path={['url']} label={t('URL')} schema={schema.url} />
            </div>

            <ThumbnailField path={['thumbnail']} label={t('Thumbnail')} onFileSelect={setThumbnail} required />

            <div class="grid grid-cols-3 gap-4">
              <BooleanField path={['featured']} label={t('Featured')} schema={schema.featured} class="self-start" />
              <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
              <NumberField path={['durationSeconds']} label={t('Duration (seconds)')} schema={schema.durationSeconds} />
            </div>

            <CommaSeparatedField path={['quizzes']} label={t('Comma separated quiz ids')} schema={v.pipe(v.string())} />

            <div class="flex gap-4">
              <TextField path={['channel']} label={t('Channel')} schema={schema.channel} multiline />
              <TextField path={['license']} label={t('License')} schema={schema.license} multiline />
            </div>

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <a
                  href={`/media/${source.id}`}
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
                <actions.Save onSave={saveMedia} />
              </fieldset>
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
