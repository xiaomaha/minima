import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, getValue, valiForm } from '@modular-forms/solid'
import { createFileRoute, Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import * as v from 'valibot'
import { accountV1ApplyPasswordChange, accountV1RequestPasswordChange } from '@/api'
import { vApplyPasswordChangeSchema, vRequestPasswordChangeSchema } from '@/api/valibot.gen'
import { BASE_URL } from '@/config'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
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
  const params = Route.useSearch()
  const token = params().token
  return (
    <Show when={!!token} fallback={<RequestPasswordChange />}>
      <ApplyPasswordChange token={token!} />
    </Show>
  )
}

const RequestPasswordChange = () => {
  const [t] = useTransContext()
  const navigate = Route.useNavigate()

  const [requestForm, { Form, Field }] = createForm<v.InferInput<typeof vRequestPasswordChangeSchema>>({
    initialValues: { callbackUrl: `${BASE_URL}${Route.fullPath}` },
    validate: valiForm(vRequestPasswordChangeSchema),
  })

  const requestPasswordChange = async (values: v.InferInput<typeof vRequestPasswordChangeSchema>) => {
    const { error } = await accountV1RequestPasswordChange({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(requestForm, error, t)
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

  return (
    <Form onSubmit={requestPasswordChange}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-4">
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
          isPending={requestForm.submitting}
          disabled={!requestForm.dirty}
          class="btn btn-neutral mt-4"
        />

        <LoginLink />
      </fieldset>
    </Form>
  )
}

const ApplyPasswordChange = (props: { token: string }) => {
  const [t] = useTransContext()
  const navigate = Route.useNavigate()

  const [applyForm, { Form, Field }] = createForm<
    v.InferInput<typeof vApplyPasswordChangeSchema> & { passwordConfirm: string }
  >({
    initialValues: { token: props.token },
    validate: valiForm(vApplyPasswordChangeSchema),
  })

  const applyPasswordChange = async (values: v.InferInput<typeof vApplyPasswordChangeSchema>) => {
    const { error } = await accountV1ApplyPasswordChange({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(applyForm, error, t)
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

  return (
    <Form onSubmit={applyPasswordChange}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-4">
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
            const password = getValue(applyForm, 'password')
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
          isPending={applyForm.submitting}
          disabled={!applyForm.dirty}
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
