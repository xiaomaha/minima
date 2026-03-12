import { createFileRoute, Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import * as v from 'valibot'
import { accountV1ApplyPasswordChange, accountV1RequestPasswordChange } from '@/api'
import { vApplyPasswordChangeSchema, vRequestPasswordChangeSchema } from '@/api/valibot.gen'
import { handleFormErrors } from '@/shared/error/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { LoginLink } from './-LoginLink'

const searchSchema = v.object({
  token: v.optional(v.pipe(v.string(), v.minLength(32))),
})

export const Route = createFileRoute('/(auth)/password-change')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const token = search().token
  return (
    <Show when={!!token} fallback={<RequestPasswordChange />}>
      <ApplyPasswordChange token={token!} />
    </Show>
  )
}

const RequestPasswordChange = () => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const form = createForm<v.InferInput<typeof vRequestPasswordChangeSchema>>({
    initialValues: { email: '', callbackUrl: `${window.location.origin}${Route.fullPath}` },
    validate: valiForm(vRequestPasswordChangeSchema),
  })

  const requestPasswordChange = async (values: v.InferInput<typeof vRequestPasswordChangeSchema>) => {
    const { error } = await accountV1RequestPasswordChange({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(form, error, t)
      return
    }

    showToast({
      title: t('Password change'),
      message: t(
        'Verification email has been sent to your email address.' +
          ' Please check your email and click on the link to verify your account.',
      ),
      type: 'success',
      duration: 1000 * 5,
    })
    navigate({ to: '/login', replace: true })
  }

  const [formState, { Form, Field }] = form

  return (
    <Form onSubmit={requestPasswordChange}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-5">
        <legend class="fieldset-legend mb-0">{t('Request password change')}</legend>

        <span class="label">{t('Enter your account email address')}</span>

        <Field name="email">
          {(field, props) => (
            <FormInput error={field.error}>
              <input {...props} class="input" placeholder={t('Email')} autofocus />
            </FormInput>
          )}
        </Field>

        <Field name="callbackUrl">{() => null}</Field>

        <SubmitButton
          label={t('Request password change')}
          isPending={formState.submitting}
          disabled={!formState.dirty}
          class="btn btn-neutral mt-4"
        />

        <LoginLink />
      </fieldset>
    </Form>
  )
}

const ApplyPasswordChange = (props: { token: string }) => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const form = createForm<v.InferInput<typeof vApplyPasswordChangeSchema> & { passwordConfirm: string }>({
    initialValues: { password: '', passwordConfirm: '', token: props.token },
    validate: valiForm(vApplyPasswordChangeSchema),
  })

  const applyPasswordChange = async (values: v.InferInput<typeof vApplyPasswordChangeSchema>) => {
    const { error } = await accountV1ApplyPasswordChange({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(form, error, t)
      return
    }

    showToast({
      title: t('Password change'),
      message: t('Your password has been changed. You can now login to your account with your new password.'),
      type: 'success',
      duration: 1000 * 5,
    })
    navigate({ to: '/login', replace: true })
  }

  const [formState, { Form, Field, getValue }] = form

  return (
    <Form onSubmit={applyPasswordChange}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-5">
        <legend class="fieldset-legend mb-0">{t('Password change')}</legend>

        <span class="label">{t('Enter your new password')}</span>

        <Field name="password">
          {(field, props) => (
            <FormInput error={field.error}>
              <input {...props} type="password" class="input" placeholder={t('New password')} autofocus />
            </FormInput>
          )}
        </Field>

        <Field
          name="passwordConfirm"
          validate={(value) => {
            const password = getValue('password')
            return value === password ? '' : t('Passwords do not match')
          }}
        >
          {(field, props) => (
            <FormInput error={field.error}>
              <input {...props} type="password" class="input" placeholder={t('Confirm new password')} />
            </FormInput>
          )}
        </Field>

        <Field name="token">{() => null}</Field>

        <SubmitButton
          label={t('Change password')}
          isPending={formState.submitting}
          disabled={!formState.dirty}
          class="btn btn-neutral mt-4"
        />

        <div class="text-center">
          <Link to="/login" class="ml-1 link">
            {t('Login')}
          </Link>
        </div>
      </fieldset>
    </Form>
  )
}
