import { IconLogout } from '@tabler/icons-solidjs'
import { logout } from './logout'

export const LogoutButton = () => {
  return (
    <button type="button" class="btn btn-ghost btn-circle" onClick={logout}>
      <IconLogout />
    </button>
  )
}
