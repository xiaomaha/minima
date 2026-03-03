import { IconExternalLink } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { createSignal, For, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type ExamSpec, studioV1SaveExam } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, NumberField, RichTextField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { questionFormats, vExamEditingSpec } from './data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Exam = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { source, staging } = useEditing<ExamSpec>()

  const schema = vExamEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveExam = async (validated: v.InferOutput<typeof vExamEditingSpec>) => {
    const { data: id } = await studioV1SaveExam({
      body: {
        data: { id: staging.id === EMPTY_CONTENT_ID ? undefined : staging.id, ...validated },
        thumbnail: thumbnail(),
      },
    })
    setThumbnail(undefined)

    props.onSave(id)

    if (staging.id === EMPTY_CONTENT_ID) {
      navigate({ to: `/studio/exam/${id}`, replace: true })
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, questions: source.questions }))))
    }
  }

  return (
    <DataAction rootKey={[]} excludeKeys={[['questions']]} label={t('Exam')} schema={vExamEditingSpec}>
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
              <NumberField path={['durationSeconds']} label={t('Duration (seconds)')} schema={schema.durationSeconds} />
              <NumberField path={['gradeDueDays']} label={t('Grade due days')} schema={schema.gradeDueDays} />
              <NumberField
                path={['appealDeadlineDays']}
                label={t('Appeal deadline')}
                schema={schema.appealDeadlineDays}
              />
              <NumberField path={['confirmDueDays']} label={t('Confirm due days')} schema={schema.confirmDueDays} />
            </div>

            <div class="divider" />

            <TextField
              path={['honorCode', 'title']}
              label={t('Honor code title')}
              schema={schema.honorCode.entries.title}
            />
            <RichTextField
              path={['honorCode', 'code']}
              label={t('Honor code content')}
              schema={schema.honorCode.entries.code}
            />

            <div class="divider" />

            <TextField
              path={['questionPool', 'description']}
              label={t('Question pool description')}
              schema={schema.questionPool.entries.description}
              multiline
            />
            <div class="grid grid-cols-4 gap-4">
              <For each={questionFormats}>
                {(format) => (
                  <NumberField
                    path={['questionPool', 'composition', format]}
                    label={t(format)}
                    schema={v.pipe(v.number(), v.integer(), v.minValue(0, t('at least 0')))}
                  />
                )}
              </For>
            </div>

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <Show when={source.id !== EMPTY_CONTENT_ID}>
                <a
                  href={`/exam/${source.id}/session?mode=preview`}
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
              <actions.Save onSave={saveExam} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
