import { createForm, reset, setValue, valiForm } from '@modular-forms/solid'
import { createFileRoute } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import type * as v from 'valibot'
import { accountV1UpdateMe } from '@/api'
import { vUserUpdateSchema } from '@/api/valibot.gen'
import { LANGUAGES } from '@/config'
import { store as accountStore, setUser } from '@/routes/(app)/account/-store'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { useTranslation } from '@/shared/solid/i18n'
import { AvatarEdit } from './-profile/AvatarEdit'
import { OtpSetup } from './-profile/OtpSetup'

export const Route = createFileRoute('/(app)/account/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const [updateForm, { Form, Field }] = createForm<v.InferInput<typeof vUserUpdateSchema>>({
    initialValues: { ...accountStore.user },
    validate: valiForm(vUserUpdateSchema),
  })

  const updateProfile = async (values: v.InferInput<typeof vUserUpdateSchema>) => {
    const { data, error } = await accountV1UpdateMe({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(updateForm, error, t)
      return
    }

    setUser(data)
    reset(updateForm, { initialValues: values })
  }

  const displayName = () => accountStore.user?.nickname || accountStore.user?.name

  return (
    <Show when={accountStore.user}>
      <div class="m-auto max-w-md py-8 space-y-8">
        <div class="flex gap-6 justify-center mt-8">
          <AvatarEdit />
          <div class="self-center space-y-2">
            <div class="font-bold text-2xl">{displayName()}</div>
            <div class="label text-sm">{new Date(accountStore.user!.modified).toLocaleString()}</div>
          </div>
        </div>

        <Form onSubmit={updateProfile}>
          <fieldset class="fieldset w-full space-y-8">
            <Field name="name">
              {(field, props) => (
                <FormInput error={field.error} help={t('Real Name is required to issue certificates.')}>
                  <input {...props} value={field.value} class="input w-full" placeholder={t('Name')} autofocus />
                </FormInput>
              )}
            </Field>

            <Field name="nickname">
              {(field, props) => (
                <FormInput error={field.error} help={t('Nickname is used to display your in the class')}>
                  <input {...props} value={field.value} class="input w-full" placeholder={t('Nickname')} />
                </FormInput>
              )}
            </Field>

            <Field name="phone">
              {(field, props) => (
                <FormInput error={field.error} help={t('Optional')}>
                  <input {...props} value={field.value ?? ''} class="input w-full" placeholder={t('Phone Number')} />
                </FormInput>
              )}
            </Field>

            <Field name="birthDate">
              {(field, props) => (
                <FormInput error={field.error} help={t('Optional')}>
                  <input
                    {...props}
                    type="date"
                    value={field.value ?? ''}
                    onInput={(e) => {
                      const value = e.currentTarget.value
                      setValue(updateForm, 'birthDate', value || null)
                    }}
                    class="input w-full"
                    placeholder={t('Birthdate')}
                  />
                </FormInput>
              )}
            </Field>

            <Field name="language">
              {(field, props) => (
                <FormInput error={field.error} help={t('Optional')}>
                  <select {...props} class="select w-full">
                    <option value="">{t('Select Language')}</option>
                    <For each={LANGUAGES}>
                      {({ label, value }) => (
                        <option value={value} selected={field.value === value}>
                          {label}
                        </option>
                      )}
                    </For>
                  </select>
                </FormInput>
              )}
            </Field>

            <FormInput help={t('Email change requires verifying your new email address.')}>
              <label class="input w-full">
                <input type="email" value={accountStore.user?.email} readOnly />
                <button
                  type="button"
                  class="btn btn-link btn-sm"
                  onClick={() => navigate({ to: '/account/email-change' })}
                >
                  {t('Change Email')}
                </button>
              </label>
            </FormInput>

            <SubmitButton
              label={t('Update')}
              isPending={updateForm.submitting}
              disabled={!updateForm.dirty}
              class="btn btn-primary mt-4"
            />
          </fieldset>
        </Form>

        <OtpSetup />
      </div>
    </Show>
  )
}
