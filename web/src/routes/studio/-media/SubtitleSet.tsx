import { IconPlus } from '@tabler/icons-solidjs'
import { batch, createSignal, For, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { type MediaSpec, studioV1CreateMediaQuiz, studioV1DeleteMediaSubtitle, studioV1SaveMediaSubtitle } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { type State, useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { SelectField, TextField } from '../-studio/field'
import { getNestedState, getNestedValue, scrollToLastPaper } from '../-studio/helper'
import { Paper } from '../-studio/Paper'
import { EmptySubtitle, langulageOptions, vSubtitleEditingSpec } from './data'

export const SubtitleSet = () => {
  const { t } = useTranslation()

  const { staging } = useEditing<MediaSpec>()

  const add = () => {
    staging.subtitles.push(EmptySubtitle())
    scrollToLastPaper()
  }

  return (
    <>
      <Show when={staging.subtitles.length < langulageOptions.length}>
        <div class="px-4">
          <button
            type="button"
            class="btn btn-sm btn-soft w-full shadow-xs"
            onClick={add}
            onMouseDown={(e) => e.preventDefault()}
            tabIndex={-1}
          >
            <IconPlus size={20} />
            <span>{t('Subtitle')}</span>
            <span>{staging.subtitles.length}</span>
          </button>
        </div>
      </Show>

      <For each={staging.subtitles}>{(_, index) => <Subtitle index={index()} />}</For>
    </>
  )
}

const Subtitle = (props: { index: number }) => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<MediaSpec>()

  const save = async () => {
    const subtitle = staging.subtitles[props.index]!
    await studioV1SaveMediaSubtitle({ path: { id: staging.id }, body: subtitle })

    batch(() => {
      const newSet = [...staging.subtitles.filter((s) => s.lang !== subtitle.lang), subtitle]
      source.subtitles = structuredClone(unwrap(newSet))
      staging.subtitles = newSet
    })
  }

  const remove = async () => {
    if (!getNestedValue(source, ['subtitles', props.index])) {
      staging.subtitles.splice(props.index, 1)
      return props.index
    }

    if (!confirm(t('Are you sure you want to remove this subtitle?'))) return

    const lang = staging.subtitles[props.index]?.lang
    if (!lang) return

    await studioV1DeleteMediaSubtitle({ path: { id: staging.id, lang } })
    batch(() => {
      source.subtitles.splice(props.index, 1)
      staging.subtitles.splice(props.index, 1)
    })
    return props.index
  }

  const saved = () => !!getNestedValue(source, ['subtitles', props.index])
  const state = () => getNestedState(fieldState, ['subtitles', props.index, 'body']) as State | undefined
  const subtitleDirty = () => state()?.dirty ?? false

  const [inCreating, setInCreating] = createSignal(false)
  const createQuiz = async () => {
    setInCreating(true)
    const lang = staging.subtitles[props.index]!.lang
    try {
      const { data, error } = await studioV1CreateMediaQuiz({ path: { id: staging.id, lang }, throwOnError: false })
      if (!error) {
        // error will be handled in global error handler
        batch(() => {
          source.quizzes.push(data!)
          staging.quizzes.push(data!)
        })
      }
    } finally {
      setInCreating(false)
    }
  }

  return (
    <DataAction rootKey={['subtitles', props.index]} label={t('Subtitle')} schema={vSubtitleEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper fallback={<div class="line-clamp-1"></div>} class="pb-10 space-y-4!">
            <div class="flex gap-4 items-start">
              <div class="max-w-40 w-full self-start">
                <SelectField
                  path={['subtitles', props.index, 'lang']}
                  label={t('Language')}
                  schema={vSubtitleEditingSpec.entries.lang}
                  options={Object.fromEntries(langulageOptions)}
                  readonly={saved()}
                />
              </div>

              <TextField
                path={['subtitles', props.index, 'body']}
                label={t('Subtitle content')}
                schema={vSubtitleEditingSpec.entries.body}
                multiline
                class="h-24 text-xs"
              />
            </div>

            <div class="flex gap-2 items-center justify-end">
              <actions.Remove onRemove={() => remove()} />
              <actions.Reset label="" />
              <actions.Save label={t('Save')} onSave={save} />
              <fieldset disabled={subtitleDirty()}>
                <button
                  type="button"
                  class="btn btn-sm btn-primary relative"
                  onclick={() => createQuiz()}
                  onMouseDown={(e) => e.preventDefault()}
                  tabIndex={-1}
                  disabled={inCreating()}
                >
                  <Show when={inCreating()}>
                    <span class="loading loading-spinner absolute" />
                  </Show>
                  {t('Create quiz with AI')}
                </button>
              </fieldset>
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
