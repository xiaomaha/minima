import { IconExternalLink } from '@tabler/icons-solidjs'
import { batch, createSignal, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type * as v from 'valibot'
import { type QuizSpec, studioV1SaveQuiz } from '@/api'
import { QuizDialog } from '@/routes/(app)/-shared/quiz/QuizDialog'
import { clearCachedStoreBy, initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, NumberField, TextField, ThumbnailField } from '../-studio/field'
import { Paper } from '../-studio/Paper'
import { EmptyQuiz, vQuizEditingSpec } from './-data'

interface Props {
  onSave: (id: string) => Promise<void>
}

export const Quiz = (props: Props) => {
  const { t } = useTranslation()

  const { source, staging } = useEditing<QuizSpec>()

  const schema = vQuizEditingSpec.entries

  const [thumbnail, setThumbnail] = createSignal<File | undefined>()

  const saveQuiz = async (validated: v.InferOutput<typeof vQuizEditingSpec>) => {
    const { data } = await studioV1SaveQuiz({ body: { data: { id: staging.id, ...validated }, thumbnail: thumbnail() } })
    setThumbnail(undefined)

    // save without question set
    const editingQuestionSet = structuredClone(unwrap(staging.questionSet))

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore(
          'studioV1GetQuiz',
          { path: { id: data } },
          structuredClone(unwrap({ ...staging, id: data, questionSet: [] })),
        )
        modifyMutable(staging, reconcile(structuredClone(EmptyQuiz())))
      })
      // after onSave
      queueMicrotask(() => (staging.questionSet = editingQuestionSet))
    } else {
      modifyMutable(source, reconcile(structuredClone(unwrap({ ...staging, questionSet: source.questionSet }))))
    }

    props.onSave(data)
  }

  const [preview, setPreview] = createSignal(false)

  const previewQuiz = () => {
    // cache clear
    clearCachedStoreBy(new RegExp(`quizV1GetSession.*${staging.id}`))
    setPreview(true)
  }

  return (
    <>
      <DataAction rootKey={[]} excludeKeys={[['questionSet']]} label={t('Quiz')} schema={vQuizEditingSpec}>
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
                <BooleanField path={['featured']} label={t('Featured')} schema={schema.featured} class="self-start" />
                <NumberField path={['passingPoint']} label={t('Passing point')} schema={schema.passingPoint} />
                <NumberField path={['maxAttempts']} label={t('Max attempts')} schema={schema.maxAttempts} />
              </div>

              <div class="divider" />

              <TextField
                path={['questionPool', 'description']}
                label={t('Question pool description')}
                schema={schema.questionPool.entries.description}
                multiline
              />
              <NumberField
                path={['questionPool', 'selectCount']}
                label={t('Select count')}
                schema={schema.questionPool.entries.selectCount}
              />

              <div class="divider" />

              <div class="flex gap-2 items-center justify-end">
                <Show when={source.id !== EMPTY_CONTENT_ID}>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm btn-link mr-auto no-underline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={previewQuiz}
                    tabIndex={-1}
                  >
                    <IconExternalLink size={20} />
                    {t('Preview')}
                    <span class="text-base-content/40">{new Date(source.modified).toLocaleString()}</span>
                  </button>
                </Show>

                <actions.Import />
                <actions.Export />
                <actions.Reset />

                <fieldset disabled={false}>
                  <actions.Save onSave={saveQuiz} />
                </fieldset>
              </div>
            </Paper>
          </div>
        )}
      </DataAction>
      <Show when={preview()}>
        <QuizDialog id={staging.id} open={preview()} onClose={() => setPreview(false)} />
      </Show>
    </>
  )
}
