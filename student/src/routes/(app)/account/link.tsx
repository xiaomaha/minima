import { IconLogin2 } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createMemo, For, Match, onMount, Show, Switch } from 'solid-js'
import * as v from 'valibot'
import { type SsoAccountSchema, ssoV1DeleteAccount, ssoV1GetAccounts, ssoV1Link } from '@/api'
import { SSO_PROVIDERS } from '@/config'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { GitHubIcon } from '@/shared/GitHubIcon'
import { GoogleIcon } from '@/shared/icon/GoogleIcon'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { NoContent } from '@/shared/NoContent'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { createPersistentSignal } from '@/shared/solid/persistent-signal'
import { showToast } from '@/shared/toast/store'
import { capitalize } from '@/shared/utils'

const searchSchema = v.object({
  error: v.optional(v.pipe(v.string())),
})

export const Route = createFileRoute('/(app)/account/link')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const search = Route.useSearch()

  const [accounts, { setStore }] = createCachedStore(
    'ssoV1GetAccounts',
    () => ({}),
    async () => {
      const { data } = await ssoV1GetAccounts()
      return data
    },
  )

  const accountMap = createMemo(
    () =>
      accounts.data?.reduce(
        (acc, account) => {
          acc[account.provider] = account
          return acc
        },
        {} as Record<string, SsoAccountSchema>,
      ) || {},
  )

  onMount(() => {
    const error = search().error
    if (error) {
      showToast({ title: 'Error', message: t(error), type: 'error' })
      // clean url display
      window.history.replaceState({}, '', window.location.pathname)
    }
  })

  const [linking, setLinking] = createPersistentSignal<string | null>('sso:linking', null)

  onMount(() => {
    if (linking()) {
      setLinking(null)
    }
  })

  const handleLink = async (account: SsoAccountSchema | undefined, provider: string, onOff: boolean) => {
    if (!accountStore.user || !accounts.data) return false

    if (!onOff) {
      if (!account) return false

      if (!accountStore.user.hasPassword && accounts.data.length <= 1) {
        showToast({
          title: '',
          message: t('Because you have no password, you cannot delete the last login account.'),
          type: 'warning',
        })
        return false
      }

      await ssoV1DeleteAccount({ path: { id: account.id } })
      setStore(
        'data',
        accounts.data.filter((a) => a.id !== account.id),
      )
    } else {
      setLinking(provider)

      try {
        const { data } = await ssoV1Link({
          path: { provider },
          body: { redirectTo: window.location.href },
        })
        window.location.href = data.authorizationUrl
      } catch (_) {
        // Toast will be handled globally
        setLinking(null)
      }
    }
  }

  return (
    <div class="m-auto max-w-md space-y-4">
      <Show when={accounts.data?.length === 0}>
        <NoContent icon={IconLogin2} message={t('No accounts connected')} />
      </Show>
      <Show when={accounts.data?.length}>
        <div class="text-sm label my-4 mt-8">
          {t('Connect external accounts to sign in easily without entering your password')}
        </div>
        <For each={SSO_PROVIDERS}>
          {(provider) => (
            <div class="rounded shadow-sm p-4 flex items-center gap-4 justify-between relative">
              <Show when={linking() === provider}>
                <LoadingOverlay class={'absolute!'} />
              </Show>
              <div class="flex items-center gap-4">
                <Switch>
                  <Match when={provider === 'google'}>
                    <GoogleIcon size={48} />
                  </Match>
                  <Match when={provider === 'github'}>
                    <GitHubIcon size={48} />
                  </Match>
                </Switch>
                <div class="text-base-content/60">
                  <div class="mb-0.5 text-base-content">{t(capitalize(provider))}</div>
                  <Show
                    when={accountMap()[provider]}
                    fallback={
                      <Show when={accounts.loading}>
                        <div class="h-5 w-46 skeleton" />
                      </Show>
                    }
                  >
                    <div class="text-sm">{accountMap()[provider]!.email}</div>
                  </Show>
                </div>
              </div>
              <label class="label text-xs">
                <Show when={accountMap()[provider]} fallback={<div class="text-xs">{t('Not connected')}</div>}>
                  <span class="badge badge-xs badge-primary">{t('Connected')}</span>
                </Show>

                <input
                  type="checkbox"
                  class="toggle ml-1"
                  checked={!!accountMap()[provider]}
                  onchange={async (e) => {
                    const result = await handleLink(accountMap()[provider], provider, e.currentTarget.checked)
                    if (result === false) {
                      e.currentTarget.checked = !e.currentTarget.checked
                    }
                  }}
                />
              </label>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
