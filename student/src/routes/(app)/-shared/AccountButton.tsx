import { IconLogout, IconUser } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { accountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { logout } from './logout'

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

  const goToProfile = () => {
    closeDropdown()
    navigate({ to: '/account/profile' })
  }

  return (
    <Show when={accountStore.user}>
      <div class="dropdown dropdown-end">
        <button type="button" tabindex="0" class="btn btn-circle btn-ghost">
          <Avatar user={accountStore.user!} rounded />
        </button>
        <ul
          tabindex="0"
          class="mt-0 rounded-box bg-base-100 menu dropdown-content [&_li>*]:rounded-none p-1 py-2 z-1 w-60 shadow-xl"
        >
          <li>
            <button type="button" class="btn btn-ghost justify-start gap-4 border-0 font-normal" onClick={goToProfile}>
              <IconUser />
              {t('Profile')}
            </button>
          </li>
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
