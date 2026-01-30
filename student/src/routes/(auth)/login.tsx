import { createForm, valiForm } from '@modular-forms/solid'
import { createFileRoute, Link, useLocation } from '@tanstack/solid-router'
import * as v from 'valibot'
import { accountV1Login } from '@/api/sdk.gen'
import { vLoginSchema } from '@/api/valibot.gen'
import { LOGIN_REDIRECT_PATH } from '@/config'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { useTranslation } from '@/shared/solid/i18n'
import { setUser } from '../(app)/account/-store'
import { SSOButtons } from '../(auth)/-SSOButtons'

const searchSchema = v.object({
  next: v.optional(v.pipe(v.string(), v.startsWith('/'))),
  sso: v.optional(v.boolean()),
  error: v.optional(v.string()),
})

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const location = useLocation()

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
    navigate({ to: search().next || LOGIN_REDIRECT_PATH, replace: true })
  }

  return (
    <Form onSubmit={login}>
      <fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4 space-y-5">
        <legend class="fieldset-legend">{t('Login')}</legend>
        <Field name="email">
          {(field, props) => (
            <FormInput error={field.error}>
              <input
                {...props}
                type="email"
                value={location().state?.email ?? ''}
                class="input"
                placeholder={t('Email')}
                autofocus={!search().sso}
              />
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

        <SSOButtons search={search} />

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
