import { createForm, reset } from '@modular-forms/solid'
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

  const [agreementForm, { Form, Field }] = createForm<v.InferInput<typeof vPolicyVersionAgreementSchema>>({
    initialValues: {},
  })

  createEffect(() => {
    if (policies.data) {
      reset(
        agreementForm,
        policies.data.reduce(
          (acc, policy) => {
            acc[String(policy.effectiveVersion.id)] = !!policy.effectiveVersion.accepted
            return acc
          },
          {} as Record<string, boolean>,
        ),
      )
    }
  })

  const agree = async (values: v.InferInput<typeof vPolicyVersionAgreementSchema>) => {
    await operationV1AgreePolicies({ body: values })

    // update policy cache
    setStore('data', (prev) => {
      if (!prev) return prev
      return prev.map((policy) => {
        policy.effectiveVersion.accepted = values[String(policy.effectiveVersion.id)]
        return policy
      })
    })

    // update user cache
    setUserStore('user', 'agreementRequired', false)
  }

  const handleClose = async () => {
    if (accountStore.user?.agreementRequired) {
      await logout()
    }
    props.setOpen(false)
  }

  return (
    <Dialog
      title={t('{{platform}} Site Policies', { platform: PLATFORM_NAME })}
      boxClass="max-w-2xl"
      open={props.open && !policies.loading}
      onClose={handleClose}
      disableBackdrop={!!accountStore.user?.agreementRequired}
    >
      <Form onSubmit={agree}>
        <div class="px-8 space-y-6 mb-8">
          <div class="text-xs text-info mb-8">
            {t('Before you use this site, please read and agree to the following policies.')}
          </div>
          <For each={policies.data}>
            {(policy) => (
              <div class="space-y-2">
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
                    type="boolean"
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
                          checked={!!policy.effectiveVersion.accepted}
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
              isPending={agreementForm.submitting}
              disabled={!agreementForm.dirty}
              class="btn btn-neutral mt-4 w-full"
            />
          </Show>
        </div>
      </Form>
    </Dialog>
  )
}
