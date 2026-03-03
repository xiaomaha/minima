import { IconMinus } from '@tabler/icons-solidjs'
import { batch, createMemo, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  studioV1ContentSuggestions,
  studioV1RemoveCourseRelation,
  studioV1SaveCourseRelations,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vCourseRelationEditingSpec } from './data'

export const CourseRelations = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseRelations({
      path: { id: staging.id },
      body: staging.assets.courseRelations.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.courseRelations[i]!.id = id
      })
      staging.assets.courseRelations.splice(ids.length)
      source.assets.courseRelations = structuredClone(unwrap(staging.assets.courseRelations))
    })
  }

  const remove = async (index: number) => {
    const relatedCourse = staging.assets.courseRelations[index]
    if (!relatedCourse) return

    if (!relatedCourse.id) {
      staging.assets.courseRelations.splice(index, 1)
      fieldState.assets.courseRelations.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseRelation({ path: { id: staging.id, course_relation_id: relatedCourse.id } })
    batch(() => {
      source.assets.courseRelations.splice(index, 1)
      staging.assets.courseRelations.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromSurvey = staging.assets.courseRelations[from]
    if (!fromSurvey) return false

    batch(() => {
      const courseRelations = [...staging.assets.courseRelations]
      const [removed] = courseRelations.splice(from, 1)
      courseRelations.splice(to, 0, removed!)
      staging.assets.courseRelations = courseRelations
    })

    return true
  }

  const [touched, setTouched] = createSignal(false)
  const [suggestions] = createCachedStore(
    'studioV1ContentSuggestions',
    () => (touched() ? { query: { kind: 'course' as const } } : undefined),
    async (options) => (await studioV1ContentSuggestions(options)).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.title, data])))
  const cleanedSuggestionList = createMemo(() => {
    const ids = staging.assets.courseRelations.map((relation) => relation.relatedCourseId)
    const filtered = suggestions.data?.filter(
      (suggestion) => !ids.includes(suggestion.id) && suggestion.id !== staging.id,
    )
    return filtered?.map((s) => s.title) ?? []
  })

  const suggestionCommit = (suggestion: string) => {
    staging.assets.courseRelations.push({
      id: 0,
      label: suggestion,
      relatedCourseId: suggestionMap()[suggestion]!.id,
    })
  }

  return (
    <DataAction
      rootKey={['assets', 'courseRelations']}
      label={t('Related Courses')}
      schema={v.array(vCourseRelationEditingSpec)}
    >
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Related Courses')}</div>}>
            <div class="label text-sm shrink-0">{t('Related Courses')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Label')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.courseRelations}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td>
                              <TextField
                                path={['assets', 'courseRelations', i(), 'label']}
                                label=""
                                schema={vCourseRelationEditingSpec.entries.label}
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
