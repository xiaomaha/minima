import { createFileRoute } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import type * as v from 'valibot'
import { accountV1UpdateMe } from '@/api'
import { vUserUpdateSchema } from '@/api/valibot.gen'
import { LANGUAGES } from '@/config'
import { accountStore, setUser } from '@/routes/student/(account)/-store'
import { handleFormErrors } from '@/shared/error/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { AvatarEdit } from './-profile/AvatarEdit'
import { OtpSetup } from './-profile/OtpSetup'

export const Route = createFileRoute('/student/(account)/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const user = accountStore.user

  const form = createForm<Omit<v.InferInput<typeof vUserUpdateSchema>, 'preferences'>>({
    initialValues: { ...user },
    validate: valiForm(vUserUpdateSchema),
  })

  const [formState, { Form, Field, reset, setValue }] = form

  const updateProfile = async (values: v.InferInput<typeof vUserUpdateSchema>) => {
    const { data, error } = await accountV1UpdateMe({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(form, error, t)
      return
    }

    setUser(data)
    reset({ initialValues: data })
  }

  const displayName = () => user?.nickname || user?.name

  return (
    <Show when={user}>
      <div class="m-auto max-w-md space-y-8 w-full">
        <div class="flex gap-6 justify-center">
          <AvatarEdit />
          <div class="self-center space-y-2">
            <div class="font-bold text-2xl">{displayName()}</div>
            <div class="label text-sm">{new Date(user!.modified).toLocaleString()}</div>
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
                      setValue('birthDate', value || null)
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
                <input type="email" value={user!.email} readOnly />
                <button
                  type="button"
                  class="btn btn-link btn-sm"
                  onClick={() => navigate({ to: '/student/email-change' })}
                >
                  {t('Change Email')}
                </button>
              </label>
            </FormInput>

            <SubmitButton
              label={t('Update')}
              isPending={formState.submitting}
              disabled={!formState.dirty}
              class="btn btn-primary mt-4"
            />
          </fieldset>
        </Form>

        <Show when={user!.otpEnabled}>
          <div class="mt-4">
            <OtpSetup />
          </div>
        </Show>
      </div>
    </Show>
  )
}
