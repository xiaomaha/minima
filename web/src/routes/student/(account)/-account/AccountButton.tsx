import { IconLogout, IconUser } from '@tabler/icons-solidjs'
import { type NavigateOptions, useNavigate } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { PLATFORM_REALMS } from '@/config'
import { logout } from '@/routes/auth/-auth/logout'
import { accountStore } from '@/routes/student/(account)/-store'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'

export const AccountButton = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const closeDropdown = () => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur()
  }

  const handleLogout = async () => {
    closeDropdown()
    await logout()
  }

  const goTo = (to: NavigateOptions['to']) => {
    closeDropdown()
    navigate({ to })
  }

  const realm = location.hostname.split('.')[0]
  if (realm === 'preview') return null

  return (
    <Show when={accountStore.user}>
      <div class="dropdown dropdown-end">
        <button type="button" tabindex="0" class="btn btn-circle btn-ghost">
          <Avatar user={accountStore.user!} rounded />
        </button>
        <ul
          tabindex="0"
          class="mt-0 rounded-box bg-base-100 menu dropdown-content [&_li>*]:rounded-none [&_li]:py-0.5 p-1 py-2 z-1 w-72 shadow-xl"
        >
          <Show when={!PLATFORM_REALMS.includes(location.hostname.split('.')[0] as (typeof PLATFORM_REALMS)[number])}>
            <li>
              <button
                type="button"
                class="btn btn-ghost justify-start gap-4 border-0 font-normal"
                onClick={() => goTo('/student/profile')}
              >
                <IconUser />
                {t('Profile')}
              </button>
            </li>
          </Show>

          <li>
            <button type="button" class="btn btn-ghost justify-start gap-4 border-0 font-normal" onClick={handleLogout}>
              <IconLogout />
              {t('Logout')}
            </button>
          </li>
        </ul>
      </div>
    </Show>
  )
}
