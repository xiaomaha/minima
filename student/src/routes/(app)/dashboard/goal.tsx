import { useTransContext } from '@mbarzda/solid-i18next'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createSignal, For, Show } from 'solid-js'
import { competencyV1GetCompetencyGoals } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedStore } from '@/shared/solid/cached-store'
import { CategorySelect } from '../-shared/goal/CategorySelect'
import { GoalForm } from '../-shared/goal/GoalForm'

export const Route = createFileRoute('/(app)/dashboard/goal')({
  component: RouteComponent,
})

function RouteComponent() {
  const [t] = useTransContext()

  const [goals, { setStore }] = createCachedStore(
    'competencyV1GetCompetencyGoals',
    () => ({}),
    async () => {
      const { data } = await competencyV1GetCompetencyGoals()
      return data
    },
  )

  const existingGoalClassIds = () => goals.data?.map((g) => g.classification.id)

  const [classIdForSkills, setClassIdForSkills] = createSignal<number>()

  return (
    <div class="max-w-5xl mx-auto space-y-8 flex flex-col">
      <div class="label text-sm">{t('Competency goals')}</div>

      <div class="bg-base-300 p-8 rounded-lg space-y-4 mb-2">
        <CategorySelect setClassIdForSkills={setClassIdForSkills} />

        <Show when={classIdForSkills() && !existingGoalClassIds()?.includes(classIdForSkills()!)}>
          <div class="divider my-8" />
          <GoalForm
            classIdForSkills={classIdForSkills()!}
            setClassIdForSkills={setClassIdForSkills}
            setGoalStore={setStore}
          />
        </Show>
      </div>

      <div class="label text-xs justify-end">
        {t('Based on the NCS(Korean Competency Standars) competency framework.')}
      </div>

      <Show when={!goals.loading} fallback={<LoadingOverlay class="static" />}>
        <Show
          when={goals.data?.length}
          fallback={<div class="text-center">{t('No competency goal created yet.')}</div>}
        >
          <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
            <table class="table w-full">
              <tbody>
                <For each={goals.data}>
                  {(item, i) => (
                    <>
                      <tr>
                        <td>{i() + 1}</td>
                        <td class="text-base">{item.name}</td>
                        <td>
                          <div class="text-xs mb-1">{item.classification.ancestors.join(' / ')}</div>
                          <div class="text-base font-semibold">{item.classification.name}</div>
                        </td>
                        <td>
                          <span>{t('Skill factors: {{num}}', { num: item.factorIds.length })}</span>
                        </td>
                        <td title={new Date(item.modified).toLocaleString()}>
                          {formatDistanceToNow(item.modified, { addSuffix: true })}
                        </td>
                        <td>
                          <label class="swap swap-rotate btn btn-ghost btn-circle btn-sm">
                            <input
                              type="checkbox"
                              checked={classIdForSkills() === item.classification.id}
                              onChange={(e) => {
                                e.stopPropagation()
                                setClassIdForSkills((prev) =>
                                  prev === item.classification.id ? undefined : item.classification.id,
                                )
                              }}
                            />
                            <IconChevronUp class="swap-on" />
                            <IconChevronDown class="swap-off" />
                          </label>
                        </td>
                      </tr>

                      <Show when={classIdForSkills() === item.classification.id}>
                        <tr>
                          <td class="bg-base-300 p-8" colspan={6}>
                            <GoalForm
                              classIdForSkills={classIdForSkills()!}
                              setClassIdForSkills={setClassIdForSkills}
                              goal={item}
                              setGoalStore={setStore}
                            />
                          </td>
                        </tr>
                      </Show>
                    </>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  )
}
