import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, getValue, reset, setValue, valiForm } from '@modular-forms/solid'
import { IconTrash } from '@tabler/icons-solidjs'
import { For, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import type * as v from 'valibot'
import {
  type CompetencyGoalSchema,
  competencyV1DeleteCompetencyGoal,
  competencyV1GetClassificationSkillsData,
  competencyV1SaveCompetencyGoal,
  type SkillDataSchema,
} from '@/api'
import { vCompetencyGoalSaveSchema } from '@/api/valibot.gen'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { SubmitButton } from '@/shared/SubmitButton'
import { type CachedStoreState, createCachedStore } from '@/shared/solid/cached-store'

interface Props {
  classIdForSkills: number
  setClassIdForSkills: SetStoreFunction<number | undefined>
  goal?: CompetencyGoalSchema
  setGoalStore: SetStoreFunction<CachedStoreState<CompetencyGoalSchema[]>>
}

export const GoalForm = (props: Props) => {
  const [t] = useTransContext()

  const [skills] = createCachedStore(
    'competencyV1GetClassificationSkillsData',
    () => (props.classIdForSkills ? { path: { id: props.classIdForSkills } } : undefined),
    async (options) => {
      const { data } = await competencyV1GetClassificationSkillsData(options)
      return data
    },
  )

  const [goalForm, { Form, Field }] = createForm<v.InferInput<typeof vCompetencyGoalSaveSchema>>({
    initialValues: {
      name: props.goal?.name || '',
      classificationId: props.classIdForSkills,
      factorIds: (props.goal?.factorIds || []).slice().sort((a, b) => a - b),
      description: props.goal?.description || '',
    },
    validate: valiForm(vCompetencyGoalSaveSchema),
  })

  // modular form not supporting primitive array
  // @ts-expect-error tricky way to allow empty array
  const getFactorIds = () => getValue(goalForm, 'factorIds') || ([] as number[])
  // @ts-expect-error tricky way to allow empty array
  const setFactorIds = (val: number[]) => setValue(goalForm, 'factorIds', val)

  const save = async (values: v.InferInput<typeof vCompetencyGoalSaveSchema>) => {
    const { data, error } = await competencyV1SaveCompetencyGoal({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(goalForm, error, t)
      return
    }
    reset(goalForm, { initialValues: values })

    if (props.goal) {
      props.setGoalStore('data', (prev) => prev!.map((g) => (g.id === props.goal!.id ? data! : g)))
    } else {
      props.setGoalStore('data', (prev) => (prev ? [...prev, data!] : [data!]))
    }
  }

  const handleSkillClick = (skill: SkillDataSchema) => {
    const current = (getFactorIds() || []) as number[]
    const skillFactorIds = skill.factorSet.map((f) => f.id)
    const allSelected = skillFactorIds.every((id) => current.includes(id))
    const newValue = allSelected
      ? current.filter((id) => !skillFactorIds.includes(id)).sort((a, b) => a - b)
      : [...new Set([...current, ...skillFactorIds])].sort((a, b) => a - b)
    setFactorIds(newValue)
  }

  const deleteGoal = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this goal?'))) return
    await competencyV1DeleteCompetencyGoal({ path: { id } })
    props.setGoalStore('data', (prev) => prev!.filter((g) => g.id !== id))
    props.setClassIdForSkills(undefined)
  }

  return (
    <Show when={!skills.loading} fallback={<LoadingOverlay class="static" />}>
      <div class="label text-sm mb-4">{t("Select the skills you want to learn. Skill's highest level is 8.")}</div>
      <div class="space-y-8">
        <div class="grid grid-cols-2 gap-4">
          <For each={skills.data}>
            {(item) => (
              <ul class="list [&>li]:py-2 [&>li]:after:border-0 [&>li]:pl-0">
                <li class="list-none text-base flex items-center gap-2">
                  <span class="badge badge-xs badge-neutral">{t('Level {{num}}', { num: item.level })}</span>
                  <button type="button" class="link link-hover" onClick={() => handleSkillClick(item)}>
                    {item.name}
                  </button>
                </li>

                <For each={item.factorSet}>
                  {(item) => (
                    <li class="list-row">
                      <label class="label">
                        <input
                          type="checkbox"
                          class="checkbox bg-base-100 checkbox-sm"
                          checked={((getFactorIds() || []) as number[]).includes(item.id)}
                          onChange={() => {
                            const current = (getFactorIds() || []) as number[]
                            const newValue = current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id].sort((a, b) => a - b)
                            setFactorIds(newValue)
                          }}
                        />
                        {item.name}
                      </label>
                    </li>
                  )}
                </For>
              </ul>
            )}
          </For>
        </div>

        <Form onSubmit={save}>
          <fieldset class="fieldset space-y-4">
            {/* @ts-expect-error tricky way to allow empty array */}
            <Field name="factorIds">{(field) => <span class="text-error">{field.error}</span>}</Field>

            <Field name="name">
              {(field, props) => (
                <FormInput error={field.error}>
                  <input {...props} value={field.value} class="input w-full" placeholder={t('Title of the goal')} />
                </FormInput>
              )}
            </Field>

            <Field name="description">
              {(field, props) => (
                <FormInput error={field.error}>
                  <textarea
                    {...props}
                    value={field.value}
                    class="textarea w-full field-sizing-content"
                    placeholder={t('Additional information about this goal.')}
                  />
                </FormInput>
              )}
            </Field>

            <Field name="classificationId" type="number">
              {() => <></>}
            </Field>

            <div class="flex gap-4 w-full items-center">
              <SubmitButton
                label={t('Save goal')}
                isPending={goalForm.submitting}
                disabled={!goalForm.dirty}
                class="btn btn-primary flex-1"
              />

              <Show when={props.goal}>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-circle"
                  onClick={() => deleteGoal(props.goal!.id)}
                >
                  <IconTrash size={20} />
                </button>
              </Show>
            </div>
          </fieldset>
        </Form>
      </div>
    </Show>
  )
}
