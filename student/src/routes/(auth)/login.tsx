import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, valiForm } from '@modular-forms/solid'
import { createFileRoute, Link } from '@tanstack/solid-router'
import * as v from 'valibot'
import { accountV1Login } from '@/api/sdk.gen'
import { vLoginSchema } from '@/api/valibot.gen'
import { LOGIN_REDIRECT_URL } from '@/config'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { setUser } from '../(app)/account/-store'

const searchSchema = v.object({
  next: v.optional(v.pipe(v.string(), v.startsWith('/'))),
})

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const [t] = useTransContext()
  const params = Route.useSearch()
  const navigate = Route.useNavigate()

  const [loginForm, { Form, Field }] = createForm<v.InferInput<typeof vLoginSchema>>({
    validate: valiForm(vLoginSchema),
  })

  const login = async (values: v.InferInput<typeof vLoginSchema>) => {
    const { data: user, error } = await accountV1Login({ body: values, throwOnError: false })
    if (error) {
      handleFormErrors(loginForm, error, t)
      return
    }
    setUser(user)
    navigate({ to: params().next || LOGIN_REDIRECT_URL })
  }

  return (
    <Form onSubmit={login}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-5">
        <legend class="fieldset-legend">{t('Login')}</legend>
        <Field name="email">
          {(field, props) => (
            <FormInput error={field.error}>
              <input {...props} type="email" class="input" placeholder={t('Email')} autofocus />
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
        <Link to={'/password-change'} class="label link link-hover">
          {t('Forgot Password?')}
        </Link>
        <SubmitButton
          label={t('Login')}
          isPending={loginForm.submitting}
          disabled={!loginForm.dirty}
          class="btn btn-neutral mt-4"
        />
        <div class="justify-center label">
          {t("Haven't account?")}
          <Link to="/join" class="ml-1 link link-hover">
            {t('Join here')}
          </Link>
        </div>
      </fieldset>
    </Form>
  )
}
