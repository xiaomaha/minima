import { IconMinus } from '@tabler/icons-solidjs'
import { batch, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  type InlineSuggestionSpec,
  studioV1InlineSuggestions,
  studioV1RemoveCourseCategory,
  studioV1SaveCourseCategories,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vCourseCategoryEditingSpec } from './data'

export const Categories = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseCategories({
      path: { id: staging.id },
      body: staging.assets.courseCategories.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.courseCategories[i]!.id = id
      })
      staging.assets.courseCategories.splice(ids.length)
      source.assets.courseCategories = structuredClone(unwrap(staging.assets.courseCategories))
    })
  }

  const remove = async (index: number) => {
    const courseCategory = staging.assets.courseCategories[index]
    if (!courseCategory) return

    if (!courseCategory.id) {
      staging.assets.courseCategories.splice(index, 1)
      fieldState.assets.courseCategories.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseCategory({ path: { id: staging.id, course_category_id: courseCategory.id } })
    batch(() => {
      source.assets.courseCategories.splice(index, 1)
      staging.assets.courseCategories.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromSurvey = staging.assets.courseCategories[from]
    if (!fromSurvey) return false

    batch(() => {
      const courseCategories = [...staging.assets.courseCategories]
      const [removed] = courseCategories.splice(from, 1)
      courseCategories.splice(to, 0, removed!)
      staging.assets.courseCategories = courseCategories
    })

    return true
  }

  const addCourseCategory = (suggestion: InlineSuggestionSpec) => {
    staging.assets.courseCategories.push({
      id: 0,
      label: suggestion.label,
      categoryId: suggestion.id,
    })
  }

  return (
    <DataAction
      rootKey={['assets', 'courseCategories']}
      label={t('Categories')}
      schema={v.array(vCourseCategoryEditingSpec)}
    >
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Categories')}</div>}>
            <div class="label text-sm shrink-0">{t('Categories')}</div>

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
                      <For each={staging.assets.courseCategories}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td>
                              <TextField
                                path={['assets', 'courseCategories', i(), 'label']}
                                label=""
                                schema={vCourseCategoryEditingSpec.entries.label}
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
                placeholder={t('Add category')}
                cacheKey="studioV1InlineSuggestions"
                fetchParams={() => ({ query: { kind: 'category' as const } })}
                fetchFn={async (options) => (await studioV1InlineSuggestions(options)).data}
                excludeIds={() => staging.assets.courseCategories.map((cc) => cc.categoryId)}
                onCommit={addCourseCategory}
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
