import { IconMinus } from '@tabler/icons-solidjs'
import { batch, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type AssessmentSuggestionSpec,
  type CourseSpec,
  studioV1AssessmentSuggestions,
  studioV1RemoveCourseAssessment,
  studioV1SaveCourseAssessments,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { capitalize } from '@/shared/utils'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vAssessmentEditingSpec } from './data'

export const Assessments = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseAssessments({
      path: { id: staging.id },
      body: staging.assets.assessments.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.assessments[i]!.id = id
      })
      staging.assets.assessments.splice(ids.length)
      source.assets.assessments = structuredClone(unwrap(staging.assets.assessments))
    })
  }

  const remove = async (index: number) => {
    const assessment = staging.assets.assessments[index]
    if (!assessment) return

    if (!assessment.id) {
      staging.assets.assessments.splice(index, 1)
      fieldState.assets.assessments.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseAssessment({ path: { id: staging.id, assessment_id: assessment.id } })
    batch(() => {
      source.assets.assessments.splice(index, 1)
      staging.assets.assessments.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromAssessment = staging.assets.assessments[from]
    if (!fromAssessment) return false

    const toAssessment = staging.assets.assessments[to]
    if (fromAssessment.startOffset !== toAssessment?.startOffset) {
      showToast({
        title: t('Error'),
        message: t('Reordering is allowed only when start offset is the same'),
        type: 'error',
        duration: 1000 * 3,
      })
      return false
    }

    batch(() => {
      const assessments = [...staging.assets.assessments]
      const [removed] = assessments.splice(from, 1)
      assessments.splice(to, 0, removed!)
      staging.assets.assessments = assessments
    })

    return true
  }

  const suggestionCommit = (suggestion: AssessmentSuggestionSpec) => {
    staging.assets.assessments.push({
      id: 0,
      label: suggestion.label,
      itemId: suggestion.id,
      itemType: suggestion.itemType,
      weight: 0,
      startOffset: staging.assets.assessments.at(-1)?.startOffset ?? 0,
      endOffset: 7,
    })
  }

  return (
    <DataAction rootKey={['assets', 'assessments']} label={t('Assessments')} schema={v.array(vAssessmentEditingSpec)}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Assessments')}</div>}>
            <div class="label text-sm shrink-0">{t('Assessments')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Type')}</th>
                        <th>{t('Label')}</th>
                        <th>{t('Grading Weight')}</th>
                        <th>{t('Start offset')}</th>
                        <th>{t('End offset')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.assessments}>
                        {(assessment, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center h-12">{i() + 1}</td>
                            <td>{t(capitalize(assessment.itemType.model))}</td>
                            <td>
                              <TextField
                                path={['assets', 'assessments', i(), 'label']}
                                label=""
                                schema={vAssessmentEditingSpec.entries.label}
                                class="bg-base-200"
                              />
                            </td>

                            <td class="w-0">
                              <NumberField
                                path={['assets', 'assessments', i(), 'weight']}
                                label=""
                                schema={vAssessmentEditingSpec.entries.weight}
                                class="bg-base-200"
                              />
                            </td>

                            <td class="w-0">
                              <NumberField
                                path={['assets', 'assessments', i(), 'startOffset']}
                                label=""
                                schema={vAssessmentEditingSpec.entries.startOffset}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <NumberField
                                path={['assets', 'assessments', i(), 'endOffset']}
                                label=""
                                schema={vAssessmentEditingSpec.entries.endOffset}
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
              <InlineSuggestion<string, Parameters<typeof studioV1AssessmentSuggestions>[0]>
                placeholder={t('Add assessment')}
                cacheKey="studioV1AssessmentSuggestions"
                fetchParams={() => ({})}
                fetchFn={async (options) => (await studioV1AssessmentSuggestions(options)).data}
                excludeIds={() => [...staging.assets.courseRelations.map((cr) => cr.relatedCourseId), staging.id]}
                onCommit={(suggestion) => suggestionCommit(suggestion as AssessmentSuggestionSpec)}
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
