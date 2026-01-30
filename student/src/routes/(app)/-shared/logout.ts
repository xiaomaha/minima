import { accountV1Logout } from '@/api'
import { clearInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { clearStore } from '@/shared/solid/cached-store'
import { setUser } from '../account/-store'

export const logout = async () => {
  await accountV1Logout()
  setUser(null)
  clearStore()
  clearInfiniteStore()
}
