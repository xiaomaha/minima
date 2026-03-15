import { useNavigate } from '@tanstack/solid-router'
import { type Accessor, onMount, Show } from 'solid-js'
import { accountV1GetMe, ssoV1Authorize } from '@/api'
import { LOGIN_REDIRECT_PATH, SSO_PROVIDERS } from '@/config'
import { setUser } from '@/routes/student/(account)/-store'
import { GitHubIcon } from '@/shared/GitHubIcon'
import { GoogleIcon } from '@/shared/icon/GoogleIcon'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { useTranslation } from '@/shared/solid/i18n'
import { createPersistentSignal } from '@/shared/solid/persistent-signal'
import { showToast } from '@/shared/toast/store'

interface Props {
  search: Accessor<{ next?: string | undefined; sso?: boolean | undefined; error?: string | undefined }>
}

export const SSOButtons = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = createPersistentSignal<boolean>('sso:loading', false)

  onMount(() => {
    if (isLoading()) {
      setIsLoading(false)
    }
  })

  onMount(async () => {
    const search = props.search()

    if (search.error) {
      showToast({
        title: t('SSO Error'),
        message: search.error,
        type: 'error',
      })
      navigate({ to: '/auth/login', replace: true })
      return
    }

    if (search.sso) {
      const { data } = await accountV1GetMe()
      setUser(data)
      navigate({ to: search.next || LOGIN_REDIRECT_PATH, replace: true })
    }
  })

  const handleSSO = async (provider: string) => {
    setIsLoading(true)

    const redirectTo = new URL(window.location.href)
    redirectTo.searchParams.set('sso', 'true')

    try {
      const { data } = await ssoV1Authorize({
        path: { provider },
        body: { redirectTo: redirectTo.toString() },
      })
      window.location.href = data.authorizationUrl
    } catch {
      // Toast will be handled globally
      setIsLoading(false)
    }
  }

  return (
    <Show when={SSO_PROVIDERS.length > 0}>
      <Show when={isLoading()}>
        <LoadingOverlay />
      </Show>
      <div class="flex items-center space-x-4 w-full justify-center h-10">
        <Show when={SSO_PROVIDERS.includes('google')}>
          <button type="button" class="btn bg-white btn-circle" onClick={() => handleSSO('google')}>
            <GoogleIcon size={28} />
          </button>
        </Show>
        <Show when={SSO_PROVIDERS.includes('github')}>
          <button type="button" class="btn bg-white btn-circle" onClick={() => handleSSO('github')}>
            <GitHubIcon size={28} />
          </button>
        </Show>
      </div>
    </Show>
  )
}
