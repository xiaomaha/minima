import { accountV1Logout } from '@/api'
import { router } from '@/router'
import { setUser } from '@/routes/student/(account)/-store'
import { clearInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { clearCachedStore } from '@/shared/solid/cached-store'

export const logout = async () => {
  await accountV1Logout()
  setUser(null)
  clearCachedStore()
  clearInfiniteStore()
  router.invalidate()
}
