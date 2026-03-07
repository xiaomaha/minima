import { IconListDetails, IconLogout, IconPuzzle2, IconUser } from '@tabler/icons-solidjs'
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

  const goTo = (to: string) => {
    closeDropdown()
    navigate({ to })
  }

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
          <li>
            <button
              type="button"
              class="btn btn-ghost justify-start gap-4 border-0 font-normal"
              onClick={() => goTo('/account/profile')}
            >
              <IconUser />
              {t('Profile')}
            </button>
          </li>

          <Show when={accountStore.user?.roles.includes('editor')}>
            <li>
              <button
                type="button"
                class="btn btn-ghost justify-start gap-4 border-0 font-normal"
                onClick={() => goTo('/studio')}
              >
                <IconPuzzle2 />
                <span class="flex-1 text-left">{t('Studio')}</span>
                <span class="badge badge-primary badge-xs">{t('Editor')}</span>
              </button>
            </li>
          </Show>

          <Show when={accountStore.user?.roles.includes('tutor')}>
            <li>
              <button
                type="button"
                class="btn btn-ghost justify-start gap-4 border-0 font-normal"
                onClick={() => goTo('/grading')}
              >
                <IconListDetails />
                <span class="flex-1 text-left">{t('Grading')}</span>
                <span class="badge badge-primary badge-xs">{t('tutor')}</span>
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
