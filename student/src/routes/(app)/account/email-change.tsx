import { createForm, valiForm } from '@modular-forms/solid'
import { createFileRoute, Link } from '@tanstack/solid-router'
import { createResource, Show } from 'solid-js'
import * as v from 'valibot'
import { accountV1ApplyEmailChange, accountV1RequestEmailChange } from '@/api'
import { vRequestEmailChangeSchema } from '@/api/valibot.gen'
import { BASE_URL } from '@/config'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { setUser } from './-store'

const searchSchema = v.object({
  token: v.optional(v.pipe(v.string(), v.minLength(32))),
})

export const Route = createFileRoute('/(app)/account/email-change')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useSearch()
  const token = params().token
  return (
    <Show when={!!token} fallback={<RequestEmailChange />}>
      <ApplyEmailChange token={token!} />
    </Show>
  )
}

const RequestEmailChange = () => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const [requestForm, { Form, Field }] = createForm<v.InferInput<typeof vRequestEmailChangeSchema>>({
    initialValues: { callbackUrl: `${BASE_URL}${Route.fullPath}` },
    validate: valiForm(vRequestEmailChangeSchema),
  })

  const requestEmailChange = async (values: v.InferInput<typeof vRequestEmailChangeSchema>) => {
    const { error } = await accountV1RequestEmailChange({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(requestForm, error, t)
      return
    }

    showToast({
      title: t('Email change'),
      message: t(
        'Verification email has been sent to your email address.' +
          ' Please check your email and click on the link to verify your account.',
      ),
      type: 'success',
      duration: 1000 * 5,
    })
    navigate({ to: '/account/profile', replace: true })
  }

  return (
    <div class="w-full max-w-sm mx-auto py-12 px-4">
      <Form onSubmit={requestEmailChange}>
        <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-4">
          <legend class="fieldset-legend mb-0">{t('Email change')}</legend>

          <span class="label">{t('Enter the new email you used to when you joined.')}</span>

          <Field name="newEmail">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} class="input" placeholder={t('New email')} autofocus />
              </FormInput>
            )}
          </Field>

          <Field name="password">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} type="password" class="input" placeholder={t('Your password')} />
              </FormInput>
            )}
          </Field>

          <Field name="callbackUrl">{() => null}</Field>

          <SubmitButton
            label={t('Request email change')}
            isPending={requestForm.submitting}
            disabled={!requestForm.dirty}
            class="btn btn-primary mt-4"
          />

          <div class="text-center">
            <Link to="/account/profile" class="ml-1 link">
              {t('Back to profile')}
            </Link>
          </div>
        </fieldset>
      </Form>
    </div>
  )
}

const ApplyEmailChange = (props: { token: string }) => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  createResource(async () => {
    const { error } = await accountV1ApplyEmailChange({ body: { token: props.token }, throwOnError: false })
    if (error) {
      navigate({ to: '/account/profile', replace: true })
      return
    }

    showToast({
      title: t('Email change'),
      message: t('Your account email has been changed successfully. You can now login with your new email.'),
      type: 'success',
      duration: 1000 * 60,
    })
    navigate({ to: '/account/profile', replace: true })
    setUser(null)
  })

  return null
}
