import { IconMinus, IconPlus, IconSearch } from '@tabler/icons-solidjs'
import { For, Show } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type AssignmentSpec,
  type ContentSuggestionSpec,
  studioV1ContentSuggestions,
  studioV1GetAssignmentRubric,
  studioV1SaveAssignmentRubric,
} from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { EmptyPerformanceLevel, EmptyRubricCriterion, vRubricCriteriaEditingSpec } from './data'

export const Rubric = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<AssignmentSpec>()

  const saveCriteria = async (validated: v.InferOutput<typeof vRubricCriteriaEditingSpec>) => {
    await studioV1SaveAssignmentRubric({ path: { id: staging.id }, body: validated })
    source.rubricCriteria = structuredClone(unwrap(staging.rubricCriteria))
  }

  const addCriterion = async () => {
    staging.rubricCriteria.push(EmptyRubricCriterion())
  }

  const removeCriteria = async (criteriaIdx: number) => {
    staging.rubricCriteria.splice(criteriaIdx, 1)
    fieldState.rubricCriteria.splice(criteriaIdx, 1)
  }

  const addPerformanceLevel = async (criteriaIdx: number) => {
    const newLevel = EmptyPerformanceLevel()
    newLevel.point = (staging.rubricCriteria[criteriaIdx]!.performanceLevels.at(-1)?.point ?? 0) + 1
    staging.rubricCriteria[criteriaIdx]!.performanceLevels.push(newLevel)
  }

  const removePerformanceLevel = async (criteriaIdx: number, levelIdx: number) => {
    staging.rubricCriteria[criteriaIdx]!.performanceLevels.splice(levelIdx, 1)
    fieldState.rubricCriteria[criteriaIdx]!.performanceLevels.splice(levelIdx, 1)
  }

  const copyCriteria = async (suggestion: ContentSuggestionSpec) => {
    const { data } = await studioV1GetAssignmentRubric({ path: { id: suggestion.id } })
    staging.rubricCriteria = data
  }

  return (
    <DataAction rootKey={['rubricCriteria']} label={t('Rubric criteria')} schema={vRubricCriteriaEditingSpec}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>

          <Paper fallback={<div class="line-clamp-1">{t('Rubric criteria')}</div>}>
            <div class="label text-sm shrink-0">{t('Rubric criteria')}</div>

            <For each={staging.rubricCriteria}>
              {(_, i) => (
                <>
                  <Show when={i() !== 0}>
                    <div class="divider" />
                  </Show>
                  <div class="grid grid-cols-12 gap-4 w-full gap-y-8">
                    <div class="col-span-5 space-y-6">
                      <TextField
                        path={['rubricCriteria', i(), 'name']}
                        label={t('Criterion {{num}} name', { num: i() + 1 })}
                        schema={v.pipe(v.string(), v.nonEmpty(t('required')))}
                      />

                      <TextField
                        path={['rubricCriteria', i(), 'description']}
                        label={t('Criterion {{num}} description', { num: i() + 1 })}
                        schema={v.pipe(v.string(), v.nonEmpty(t('required')))}
                        multiline
                      />

                      <button
                        type="button"
                        class="btn btn-xs btn-link text-error block mx-auto"
                        onClick={() => removeCriteria(i())}
                        onMouseDown={(e) => e.preventDefault()}
                        tabIndex={-1}
                      >
                        <IconMinus size={20} />
                      </button>
                    </div>
                    <div class="col-span-7 space-y-6">
                      <For each={staging.rubricCriteria[i()]!.performanceLevels}>
                        {(_, j) => (
                          <div class="flex gap-4 flex-wrap">
                            <Show when={j() !== 0}>
                              <div class="divider w-full mt-0" />
                            </Show>
                            <div class="space-y-6 flex-1">
                              <TextField
                                path={['rubricCriteria', i(), 'performanceLevels', j(), 'name']}
                                label={t('Performance level {{num}} name', { num: j() + 1 })}
                                schema={v.pipe(v.string(), v.nonEmpty(t('required')))}
                              />
                              <TextField
                                path={['rubricCriteria', i(), 'performanceLevels', j(), 'description']}
                                label={t('Performance level {{num}} description', { num: j() + 1 })}
                                schema={v.pipe(v.string(), v.nonEmpty(t('required')))}
                                multiline
                              />
                            </div>

                            <div class="w-20 space-y-6">
                              <NumberField
                                path={['rubricCriteria', i(), 'performanceLevels', j(), 'point']}
                                label={t('Point')}
                                schema={v.pipe(v.number(), v.integer(), v.minValue(1, t('at least 1')))}
                              />

                              <button
                                type="button"
                                class="btn btn-xs btn-link text-error"
                                onClick={() => removePerformanceLevel(i(), j())}
                                onMouseDown={(e) => e.preventDefault()}
                                tabIndex={-1}
                              >
                                <IconMinus size={20} />
                              </button>
                            </div>
                          </div>
                        )}
                      </For>

                      <button
                        type="button"
                        class="btn btn-xs btn-link block mx-auto"
                        onClick={() => addPerformanceLevel(i())}
                        onMouseDown={(e) => e.preventDefault()}
                        tabIndex={-1}
                      >
                        <IconPlus size={20} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </For>

            <button
              type="button"
              class="btn btn-xs btn-link block mx-auto"
              onClick={addCriterion}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <IconPlus size={20} />
            </button>

            <div class="divider" />

            <div class="flex gap-2 items-center justify-end">
              <InlineSuggestion<string, Parameters<typeof studioV1ContentSuggestions>[0]>
                placeholder={t('Copy rubric criteria')}
                cacheKey="studioV1ContentSuggestions"
                fetchParams={() => ({ query: { kind: 'assignment' } })}
                fetchFn={async (options) => (await studioV1ContentSuggestions(options)).data}
                excludeIds={() => [staging.id]}
                onCommit={copyCriteria}
                icon={<IconSearch size={20} class="cursor-pointer shrink-0" />}
                inputClass="bg-transparent"
              />

              <actions.Reset />
              <actions.Save label={t('Save')} onSave={saveCriteria} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
