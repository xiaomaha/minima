import { createFileRoute } from '@tanstack/solid-router'
import { createResource, Show } from 'solid-js'
import * as v from 'valibot'
import { accountV1Activate, accountV1RequestActivation } from '@/api'
import { vRequestActivationSchema } from '@/api/valibot.gen'
import { BASE_URL } from '@/config'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { LoginLink } from './-LoginLink'

const searchSchema = v.object({
  token: v.optional(v.pipe(v.string(), v.minLength(32))),
})

export const Route = createFileRoute('/(auth)/activate')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  const token = search().token
  return (
    <Show when={!!token} fallback={<RequestActivation />}>
      <Activate token={token!} />
    </Show>
  )
}

const RequestActivation = () => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  const form = createForm<v.InferInput<typeof vRequestActivationSchema>>({
    initialValues: { email: '', callbackUrl: `${BASE_URL}${Route.fullPath}` },
    validate: valiForm(vRequestActivationSchema),
  })

  const requestActivation = async (values: v.InferInput<typeof vRequestActivationSchema>) => {
    const { error } = await accountV1RequestActivation({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(form, error, t)
      return
    }

    showToast({
      title: t('Account activation'),
      message: t(
        'Activation email has been sent to your email address.' +
          ' Please check your email and click on the link to activate your account.',
      ),
      type: 'success',
      duration: 1000 * 5,
    })
    navigate({ to: '/login', replace: true })
  }

  const [formState, { Form, Field }] = form

  return (
    <Form onSubmit={requestActivation}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-5">
        <legend class="fieldset-legend mb-0">{t('Activate account')}</legend>

        <span class="label">{t('Enter the email you used to when you joined.')}</span>

        <Field name="email">
          {(field, props) => (
            <FormInput error={field.error}>
              <input {...props} class="input" placeholder={t('Email')} autofocus />
            </FormInput>
          )}
        </Field>

        <Field name="callbackUrl">{() => null}</Field>

        <SubmitButton
          label={t('Request activation email')}
          isPending={formState.submitting}
          disabled={!formState.dirty}
          class="btn btn-neutral mt-4"
        />

        <LoginLink />
      </fieldset>
    </Form>
  )
}

const Activate = (props: { token: string }) => {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()

  createResource(async () => {
    const { data, error } = await accountV1Activate({ body: { token: props.token }, throwOnError: false })
    if (error) {
      navigate({ to: '/login', replace: true })
      return
    }

    showToast({
      title: t('Thank you for your joining!'),
      message: t('Your account has been activated. You can now login to your account.'),
      type: 'success',
      duration: 1000 * 5,
    })
    navigate({ to: '/login', replace: true, state: { email: data?.email } })
  })

  return null
}
