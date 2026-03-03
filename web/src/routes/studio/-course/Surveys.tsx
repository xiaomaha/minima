import { IconMinus } from '@tabler/icons-solidjs'
import { batch, createMemo, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  studioV1ContentSuggestions,
  studioV1RemoveCourseSurvey,
  studioV1SaveCourseSurveys,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vCourseSurveyEditingSpec } from './data'

export const Surveys = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseSurveys({
      path: { id: staging.id },
      body: staging.assets.courseSurveys.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.courseSurveys[i]!.id = id
      })
      staging.assets.courseSurveys.splice(ids.length)
      source.assets.courseSurveys = structuredClone(unwrap(staging.assets.courseSurveys))
    })
  }

  const remove = async (index: number) => {
    const courseSurvey = staging.assets.courseSurveys[index]
    if (!courseSurvey) return

    if (!courseSurvey.id) {
      staging.assets.courseSurveys.splice(index, 1)
      fieldState.assets.courseSurveys.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseSurvey({ path: { id: staging.id, course_survey_id: courseSurvey.id } })
    batch(() => {
      source.assets.courseSurveys.splice(index, 1)
      staging.assets.courseSurveys.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromSurvey = staging.assets.courseSurveys[from]
    if (!fromSurvey) return false

    const toSurvey = staging.assets.courseSurveys[to]
    if (fromSurvey.startOffset !== toSurvey?.startOffset) {
      showToast({
        title: t('Error'),
        message: t('Reordering is allowed only when start offset is the same'),
        type: 'error',
        duration: 1000 * 3,
      })
      return false
    }

    batch(() => {
      const courseSurveys = [...staging.assets.courseSurveys]
      const [removed] = courseSurveys.splice(from, 1)
      courseSurveys.splice(to, 0, removed!)
      staging.assets.courseSurveys = courseSurveys
    })

    return true
  }

  const [touched, setTouched] = createSignal(false)
  const [suggestions] = createCachedStore(
    'studioV1ContentSuggestions',
    () => (touched() ? { query: { kind: 'survey' as const } } : undefined),
    async (options) => (await studioV1ContentSuggestions(options)).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.title, data])))
  const cleanedSuggestionList = createMemo(() => {
    const ids = staging.assets.courseSurveys.map((survey) => survey.surveyId)
    const filtered = suggestions.data?.filter((suggestion) => !ids.includes(suggestion.id))
    return filtered?.map((s) => s.title) ?? []
  })

  const suggestionCommit = (suggestion: string) => {
    staging.assets.courseSurveys.push({
      id: 0,
      label: suggestion,
      surveyId: suggestionMap()[suggestion]!.id,
      startOffset: staging.assets.courseSurveys.at(-1)?.startOffset ?? 0,
      endOffset: 7,
    })
  }

  return (
    <DataAction rootKey={['assets', 'courseSurveys']} label={t('Surveys')} schema={v.array(vCourseSurveyEditingSpec)}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Surveys')}</div>}>
            <div class="label text-sm shrink-0">{t('Surveys')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Label')}</th>
                        <th>{t('Start offset')}</th>
                        <th>{t('End offset')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.courseSurveys}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td>
                              <TextField
                                path={['assets', 'courseSurveys', i(), 'label']}
                                label=""
                                schema={vCourseSurveyEditingSpec.entries.label}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <NumberField
                                path={['assets', 'courseSurveys', i(), 'startOffset']}
                                label=""
                                schema={vCourseSurveyEditingSpec.entries.startOffset}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <NumberField
                                path={['assets', 'courseSurveys', i(), 'endOffset']}
                                label=""
                                schema={vCourseSurveyEditingSpec.entries.endOffset}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <button
                                type="button"
                                class="btn btn-xs btn-link text-error"
                                onClick={() => remove(i())}
                                onMouseDown={(e) => e.preventDefault()}
                                tabIndex={-1}
                              >
                                <IconMinus size={16} />
                              </button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                )}
              </DraggableTable>
            </div>

            <div class="flex gap-2 items-center justify-end">
              <InlineSuggestion
                suggestionList={cleanedSuggestionList()}
                onCommit={suggestionCommit}
                onFocus={() => setTouched(true)}
              />

              <actions.Import label="" />
              <actions.Export label="" />
              <actions.Reset label="" />
              <actions.Save onSave={save} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
