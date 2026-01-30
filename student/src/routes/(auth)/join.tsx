import { createForm, getValue, setValue, valiForm } from '@modular-forms/solid'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, For, Show } from 'solid-js'
import * as v from 'valibot'
import type { SitePolicySchema } from '@/api'
import { accountV1Join, operationV1EffectivePolicies } from '@/api'
import { vJoinSchema } from '@/api/valibot.gen'
import { BASE_URL, TEST_MAILER_URL } from '@/config'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { ActivationLink } from './-ActivationLink'
import { LoginLink } from './-LoginLink'
import { SSOButtons } from './-SSOButtons'

const searchSchema = v.object({
  sso: v.optional(v.boolean()),
  error: v.optional(v.string()),
})

export const Route = createFileRoute('/(auth)/join')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [joinForm, { Form, Field }] = createForm<v.InferInput<typeof vJoinSchema> & { passwordConfirm: string }>({
    initialValues: { callbackUrl: `${BASE_URL}/activate` },
    validate: valiForm(vJoinSchema),
  })

  const [policies] = createCachedStore(
    'operationV1EffectivePolicies',
    () => ({}),
    async () => {
      const { data } = await operationV1EffectivePolicies()
      return data
    },
  )

  const [selectedPolicy, setSelectedPolicy] = createSignal<SitePolicySchema>()

  const join = async ({
    passwordConfirm,
    ...values
  }: v.InferInput<typeof vJoinSchema> & { passwordConfirm: string }) => {
    const { error } = await accountV1Join({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(joinForm, error, t)
      return
    }
    showToast({
      title: t('Thank you for joining!'),
      message: t(
        'Verification email has been sent to your email address.' +
          ' Please check your email and click on the link to activate your account.',
      ),
      type: 'success',
      duration: 1000 * 60,
    })
    navigate({ to: '/login' })

    if (import.meta.env.DEV) {
      window.open(TEST_MAILER_URL, '_blank')
    }
  }

  const agreeAll = () => {
    const allVersionIds = policies.data?.map((p) => String(p.effectiveVersion.id)) || []
    setValue(joinForm, 'agreements', allVersionIds)
  }

  return (
    <>
      <Dialog boxClass="max-w-xl" open={!!selectedPolicy()} onClose={() => setSelectedPolicy()}>
        <Show when={selectedPolicy()}>
          {(policy) => (
            <div class="p-4">
              <h3>{policy().title}</h3>
              <p class="py-2 text-sm">
                <span class="label block">{policy().description}</span>
                <span class="label block">
                  {new Date(policy().effectiveVersion.effectiveDate).toLocaleDateString()}
                </span>
              </p>
              <ContentViewer content={policy().effectiveVersion.body} />
              <p class="text-xs label mt-8">{t('End')}</p>
            </div>
          )}
        </Show>
      </Dialog>

      <Form onSubmit={join}>
        <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-4">
          <legend class="fieldset-legend mb-0">{t('Join')}</legend>

          <span class="label">{t('Please fill out the form below to join.')}</span>

          <Field name="name">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} class="input" placeholder={t('Name')} autofocus={!search().sso} />
              </FormInput>
            )}
          </Field>

          <Field name="email">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} class="input" placeholder={t('Email')} />
              </FormInput>
            )}
          </Field>

          <Field name="password">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} type="password" class="input" placeholder={t('Password')} />
              </FormInput>
            )}
          </Field>

          <Field
            name="passwordConfirm"
            validate={(value) => {
              const password = getValue(joinForm, 'password')
              return value === password ? '' : t('Passwords do not match')
            }}
          >
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} type="password" class="input" placeholder={t('Confirm Password')} />
              </FormInput>
            )}
          </Field>

          <Show when={!search().sso}>
            <Field
              name="agreements"
              type="string[]"
              validate={(value) => {
                const mandatoryVersionIds =
                  policies.data?.filter((p) => p.mandatory).map((p) => String(p.effectiveVersion.id)) || []
                const allMandatoryAgreed = mandatoryVersionIds.every((id) => value?.includes(id))
                return allMandatoryAgreed ? '' : t('Check all mandatory policies')
              }}
            >
              {(field) => (
                <div>
                  <div class="flex items-center justify-between my-3">
                    <span class={`label ${field.error ? 'text-error' : ''}`}>
                      {t('Please agree to the following policies')}
                    </span>
                    <button type="button" class="btn btn-xs btn-link px-0" onClick={agreeAll}>
                      {t('Agree to all')}
                    </button>
                  </div>
                  <div class="space-y-3">
                    <For each={policies.data}>
                      {(policy) => {
                        const versionId = String(policy.effectiveVersion.id)
                        return (
                          <div class="flex items-center justify-between">
                            <label class="label text-sm">
                              <input
                                type="checkbox"
                                class={`checkbox checkbox-xs ${policy.mandatory ? 'validator' : ''}`}
                                checked={field.value?.includes(versionId)}
                                onChange={(e) => {
                                  const current = field.value || []
                                  const newValue = e.currentTarget.checked
                                    ? [...current, versionId]
                                    : current.filter((id) => id !== versionId)
                                  setValue(joinForm, 'agreements', newValue)
                                }}
                                required={policy.mandatory}
                              />
                              {policy.title}
                              <Show when={!policy.mandatory}>
                                <span class="text-xs ml-1">({t('optional')})</span>
                              </Show>
                            </label>
                            <button
                              type="button"
                              class="btn btn-xs btn-link p-0"
                              onClick={() => setSelectedPolicy(policy)}
                            >
                              {t('Open')}
                            </button>
                          </div>
                        )
                      }}
                    </For>
                  </div>
                </div>
              )}
            </Field>
          </Show>

          <Field name="callbackUrl">{() => null}</Field>

          <SubmitButton
            label={t('Join')}
            isPending={joinForm.submitting}
            disabled={!joinForm.dirty}
            class="btn btn-neutral mt-4"
          />

          <SSOButtons search={search} />

          <LoginLink class="mb-0" />
          <ActivationLink />
        </fieldset>
      </Form>
    </>
  )
}
