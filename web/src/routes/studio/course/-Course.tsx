import { IconExternalLink } from '@tabler/icons-solidjs'
import { batch, createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type CourseSpec, studioV1SaveCourse } from '@/api'
import { initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, NumberField, RichTextField, SelectField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { EmptyCourse, levelOptions, vCourseEditingSpec } from './-data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Course = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<CourseSpec>()

  const schema = vCourseEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveCourse = async (validated: v.InferOutput<typeof vCourseEditingSpec>) => {
    const { data } = await studioV1SaveCourse({ body: { data: { id: staging.id, ...validated }, thumbnail: thumbnail() } })
    setThumbnail(undefined)

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore('studioV1GetCourse', { path: { id: data } }, structuredClone(unwrap({ ...staging, id: data })))
        modifyMutable(staging, reconcile(structuredClone(EmptyCourse())))
      })
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap(staging))))
    }
    props.onSave(data)
  }

  return (
    <DataAction rootKey={[]} label={t('Course')} schema={vCourseEditingSpec}>
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

            <TextField path={['objective']} label={t('Objective')} schema={schema.objective} multiline />
            <TextField path={['previewUrl']} label={t('Preview URL')} schema={schema.previewUrl} />

            <div class="grid grid-cols-3 gap-4">
              <BooleanField path={['featured']} label={t('Featured')} schema={schema.featured} class="self-start" />
              <BooleanField
                path={['verificationRequired']}
                label={t('Verification required')}
                schema={schema.verificationRequired}
                class="self-start"
              />
              <SelectField path={['level']} label={t('Level')} schema={schema.level} options={levelOptions} />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
              <NumberField path={['maxAttempts']} label={t('Max attempts')} schema={schema.maxAttempts} />
              <NumberField path={['effortHours']} label={t('Effort hours')} schema={schema.effortHours} />
            </div>

            <div class="divider" />

            <TextField path={['honorCode', 'title']} label={t('Honor code title')} schema={schema.honorCode.entries.title} />
            <RichTextField path={['honorCode', 'code']} label={t('Honor code content')} schema={schema.honorCode.entries.code} />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <a
                  href={`/course/${source.id}/session?mode=preview`}
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
                <actions.Save onSave={saveCourse} />
              </fieldset>
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
