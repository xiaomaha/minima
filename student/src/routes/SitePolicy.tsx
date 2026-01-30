import { createEffect, For, Show } from 'solid-js'
import type * as v from 'valibot'
import { operationV1AgreePolicies, operationV1EffectivePolicies } from '@/api'
import type { vPolicyVersionAgreementSchema } from '@/api/valibot.gen'
import { PLATFORM_NAME } from '@/config'
import { store as accountStore, setStore as setUserStore } from '@/routes/(app)/account/-store'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { logout } from './(app)/-shared/logout'

interface SitePolicyProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export const SitePolicy = (props: SitePolicyProps) => {
  const { t } = useTranslation()

  const [policies, { setStore }] = createCachedStore(
    'operationV1EffectivePolicies',
    () => (props.open ? (accountStore.user ? { query: { userId: accountStore.user.id } } : {}) : undefined),
    async (options) => {
      const { data } = await operationV1EffectivePolicies(options)
      return data
    },
  )

  const [formState, { Form, Field, setValue, reset }] = createForm<v.InferInput<typeof vPolicyVersionAgreementSchema>>({
    initialValues: {},
  })

  createEffect(() => {
    if (policies.data) {
      const initial = policies.data.reduce(
        (acc, policy) => {
          acc[String(policy.effectiveVersion.id)] = !!policy.effectiveVersion.accepted
          return acc
        },
        {} as Record<string, boolean>,
      )
      reset({ initialValues: initial })
    }
  })

  const agree = async (values: v.InferInput<typeof vPolicyVersionAgreementSchema>) => {
    await operationV1AgreePolicies({ body: values })

    // update policy cache
    policies.data?.forEach((policy, i) => {
      setStore('data', i, 'effectiveVersion', 'accepted', !!values[String(policy.effectiveVersion.id)])
    })

    // update user cache
    setUserStore('user', 'agreementRequired', false)
  }

  const close = async () => {
    if (accountStore.user?.agreementRequired) {
      await logout()
    }
    props.setOpen(false)
  }

  const agreeAll = () => {
    policies.data?.forEach((policy) => {
      setValue(String(policy.effectiveVersion.id), true)
    })
  }

  return (
    <Dialog
      title={t('{{platform}} Site Policies', { platform: PLATFORM_NAME })}
      boxClass="max-w-2xl"
      open={props.open && !policies.loading}
      onClose={close}
      disableBackdrop={!!accountStore.user?.agreementRequired}
    >
      <Form onSubmit={agree}>
        <div class="px-8 space-y-6 mb-8">
          <div class="text-xs text-info mb-8">
            <span class="mr-1">{t('Before you use this site, please read and agree to the following policies.')}</span>
            <button type="button" class="btn btn-xs btn-ghost btn-primary" onClick={agreeAll}>
              {t('Select All')}
            </button>
          </div>
          <For each={policies.data}>
            {(policy) => (
              <div class="space-y-1">
                <div class="flex items-center gap-2 justify-between mb-0">
                  <span class="text-base font-semibold">
                    <span class="mr-2">{policy.title}</span>
                    <Show when={policy.mandatory} fallback={<span class="text-xs label">{t('Optional')}</span>}>
                      <span class="text-base text-red-600">*</span>
                    </Show>
                  </span>
                  <span class="text-xs text-base-content/60">
                    {new Date(policy.effectiveVersion.effectiveDate).toLocaleDateString()}
                  </span>
                </div>
                <div class="text-xs label">{policy.description}</div>
                <ContentViewer
                  content={policy.effectiveVersion.body}
                  class="h-24 p-3 border border-gray-200 rounded resize overflow-auto leading-normal text-xs text-base-content/98"
                />

                <Show when={accountStore.user}>
                  <Field
                    name={String(policy.effectiveVersion.id)}
                    validate={(value) => {
                      return policy.mandatory && !value ? t('You must agree to the policy to continue.') : ''
                    }}
                  >
                    {(field, props) => (
                      <label class="label text-sm" classList={{ 'text-error': !!field.error }}>
                        <input
                          {...props}
                          type="checkbox"
                          class={`checkbox checkbox-xs ${policy.mandatory ? 'validator' : ''}`}
                          checked={field.value}
                          required={policy.mandatory}
                        />

                        {t('I have read and agree to the this code.')}
                      </label>
                    )}
                  </Field>
                </Show>
              </div>
            )}
          </For>

          <Show when={accountStore.user}>
            <SubmitButton
              label={t('Submit')}
              isPending={formState.submitting}
              disabled={!formState.dirty}
              class="btn btn-neutral w-full"
            />
          </Show>
        </div>
      </Form>
    </Dialog>
  )
}
