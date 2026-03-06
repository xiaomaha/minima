import { IconMinus } from '@tabler/icons-solidjs'
import { batch, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  type InlineSuggestionSpec,
  studioV1InlineSuggestions,
  studioV1RemoveCourseInstructor,
  studioV1SaveCourseInstructors,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vCourseInstructorEditingSpec } from './data'

export const Instructors = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseInstructors({
      path: { id: staging.id },
      body: staging.assets.courseInstructors.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.courseInstructors[i]!.id = id
      })
      staging.assets.courseInstructors.splice(ids.length)
      source.assets.courseInstructors = structuredClone(unwrap(staging.assets.courseInstructors))
    })
  }

  const remove = async (index: number) => {
    const courseInstructor = staging.assets.courseInstructors[index]
    if (!courseInstructor) return

    if (!courseInstructor.id) {
      staging.assets.courseInstructors.splice(index, 1)
      fieldState.assets.courseInstructors.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseInstructor({ path: { id: staging.id, course_instructor_id: courseInstructor.id } })
    batch(() => {
      source.assets.courseInstructors.splice(index, 1)
      staging.assets.courseInstructors.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromInstructor = staging.assets.courseInstructors[from]
    if (!fromInstructor) return false

    batch(() => {
      const courseInstructors = [...staging.assets.courseInstructors]
      const [removed] = courseInstructors.splice(from, 1)
      courseInstructors.splice(to, 0, removed!)
      staging.assets.courseInstructors = courseInstructors
    })

    return true
  }

  const addCourseInstructor = (suggestion: InlineSuggestionSpec) => {
    staging.assets.courseInstructors.push({
      id: 0,
      label: suggestion.label,
      instructorId: suggestion.id,
      lead: false,
    })
  }

  return (
    <DataAction
      rootKey={['assets', 'courseInstructors']}
      label={t('Instructors')}
      schema={v.array(vCourseInstructorEditingSpec)}
    >
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Instructors')}</div>}>
            <div class="label text-sm shrink-0">{t('Instructors')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Label')}</th>
                        <th>{t('Lead')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.courseInstructors}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td>
                              <TextField
                                path={['assets', 'courseInstructors', i(), 'label']}
                                label=""
                                schema={vCourseInstructorEditingSpec.entries.label}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <BooleanField
                                path={['assets', 'courseInstructors', i(), 'lead']}
                                label=""
                                schema={vCourseInstructorEditingSpec.entries.lead}
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
              <InlineSuggestion<number, Parameters<typeof studioV1InlineSuggestions>[0]>
                placeholder={t('Add instructor')}
                cacheKey="studioV1InlineSuggestions"
                fetchParams={() => ({ query: { kind: 'instructor' as const } })}
                fetchFn={async (options) => (await studioV1InlineSuggestions(options)).data}
                excludeIds={() => staging.assets.courseInstructors.map((ci) => ci.instructorId)}
                onCommit={addCourseInstructor}
              />

              <actions.Import />
              <actions.Export />
              <actions.Reset />
              <actions.Save onSave={save} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
