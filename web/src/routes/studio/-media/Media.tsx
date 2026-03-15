import { useNavigate } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type MediaSpec, studioV1ContentSuggestions, studioV1SaveMedia } from '@/api'
import { PreviewButton } from '@/routes/preview/-PreviewButton'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, DataBindField, NumberField, SelectField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { mediaFormatOptions, vMediaEditingSpec } from './data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Media = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { source, staging } = useEditing<MediaSpec>()

  const schema = vMediaEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveMedia = async (validated: v.InferOutput<typeof vMediaEditingSpec>) => {
    const { data: id } = await studioV1SaveMedia({
      body: {
        data: { id: staging.id === EMPTY_CONTENT_ID ? undefined : staging.id, ...validated },
        thumbnail: thumbnail(),
      },
    })
    setThumbnail(undefined)

    props.onSave(id)

    if (staging.id === EMPTY_CONTENT_ID) {
      navigate({ to: '/studio/$app/$id', params: { app: 'media', id }, replace: true })
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, subtitles: source.subtitles }))))
    }
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['subtitles']]} label={t('Media')} schema={vMediaEditingSpec}>
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
                <SelectField
                  path={['format']}
                  label={t('Format')}
                  schema={schema.format}
                  options={mediaFormatOptions}
                />
              </div>

              <TextField path={['url']} label={t('URL')} schema={schema.url} />
            </div>

            <ThumbnailField path={['thumbnail']} label={t('Thumbnail')} onFileSelect={setThumbnail} required />

            <div class="grid grid-cols-3 gap-4">
              <BooleanField path={['featured']} label={t('Featured')} schema={schema.featured} class="self-start" />
              <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
              <NumberField path={['durationSeconds']} label={t('Duration (seconds)')} schema={schema.durationSeconds} />
            </div>

            <div class="flex gap-4">
              <TextField path={['channel']} label={t('Channel')} schema={schema.channel} multiline />
              <TextField path={['license']} label={t('License')} schema={schema.license} multiline />
            </div>

            <div class="divider" />

            <DataBindField<string, Parameters<typeof studioV1ContentSuggestions>[0]>
              path={['quizzes']}
              label={t('Quizzes')}
              cacheKey="studioV1ContentSuggestions"
              fetchParams={() => ({ query: { kind: 'quiz' } })}
              fetchFn={async (options) => (await studioV1ContentSuggestions(options)).data}
              schema={v.pipe(v.string())}
              multiple
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <PreviewButton
                link={{ to: '/student/media/$id', params: { id: source.id } }}
                modified={source.modified}
                class="mr-auto"
              />

              <actions.Import />
              <actions.Export />
              <actions.Reset />
              <actions.Save onSave={saveMedia} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
