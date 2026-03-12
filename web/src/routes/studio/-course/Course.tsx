import { IconExternalLink, IconHelpCircle } from '@tabler/icons-solidjs'
import { Link, useNavigate } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type CourseSpec, studioV1InlineSuggestions, studioV1SaveCourse } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, DataBindField, NumberField, SelectField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { levelOptions, vCourseEditingSpec } from './data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Course = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { source, staging } = useEditing<CourseSpec>()

  const schema = vCourseEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveCourse = async (validated: v.InferOutput<typeof vCourseEditingSpec>) => {
    const { data: id } = await studioV1SaveCourse({
      body: {
        data: { id: staging.id === EMPTY_CONTENT_ID ? undefined : staging.id, ...validated },
        thumbnail: thumbnail(),
      },
    })
    setThumbnail(undefined)

    props.onSave(id)

    if (staging.id === EMPTY_CONTENT_ID) {
      navigate({ to: '/studio/$app/$id', params: { app: 'course', id }, replace: true })
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, assets: source.assets }))))
    }
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['assets']]} label={t('Course')} schema={vCourseEditingSpec}>
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
              <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
              <NumberField path={['maxAttempts']} label={t('Max attempts')} schema={schema.maxAttempts} />
              <NumberField path={['effortHours']} label={t('Effort hours')} schema={schema.effortHours} />

              <NumberField path={['gradeDueDays']} label={t('Grade due days')} schema={schema.gradeDueDays} />
              <NumberField
                path={['appealDeadlineDays']}
                label={t('Appeal deadline')}
                schema={schema.appealDeadlineDays}
              />
              <NumberField path={['confirmDueDays']} label={t('Confirm due days')} schema={schema.confirmDueDays} />
            </div>

            <div class="divider divider-end">
              <span class="tooltip" data-tip={t('Grading policy')}>
                <IconHelpCircle size={16} class="text-base-content/40" />
              </span>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <NumberField
                path={['gradingPolicy', 'assessmentWeight']}
                label={t('Assessment weight')}
                schema={schema.gradingPolicy.entries.assessmentWeight}
              />
              <NumberField
                path={['gradingPolicy', 'completionWeight']}
                label={t('Completion weight')}
                schema={schema.gradingPolicy.entries.completionWeight}
              />
              <NumberField
                path={['gradingPolicy', 'completionPassingPoint']}
                label={t('Completion passing point')}
                schema={schema.gradingPolicy.entries.completionPassingPoint}
              />
            </div>

            <div class="divider" />

            <DataBindField<number, Parameters<typeof studioV1InlineSuggestions>[0]>
              path={['honorCodeId']}
              label={t('Honor code')}
              cacheKey="studioV1InlineSuggestions"
              fetchParams={() => ({ query: { kind: 'honor_code' } })}
              fetchFn={async (options) => (await studioV1InlineSuggestions(options)).data}
              schema={schema.honorCodeId}
            />

            <DataBindField<number, Parameters<typeof studioV1InlineSuggestions>[0]>
              path={['faqId']}
              label={t('FAQ')}
              cacheKey="studioV1InlineSuggestions"
              fetchParams={() => ({ query: { kind: 'faq' } })}
              fetchFn={async (options) => (await studioV1InlineSuggestions(options)).data}
              schema={schema.faqId}
            />

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <Link
                  to="/student/course/$id/session"
                  params={{ id: source.id }}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-primary btn-sm btn-link mr-auto no-underline"
                  onMouseDown={(e) => e.preventDefault()}
                  tabIndex={-1}
                >
                  <IconExternalLink size={20} />
                  {t('Preview')}
                  <span class="text-base-content/40">{new Date(source.modified).toLocaleString()}</span>
                </Link>
              </Show>

              <actions.Import />
              <actions.Export />
              <actions.Reset />
              <actions.Save onSave={saveCourse} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
