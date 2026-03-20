import { createEffect, untrack } from 'solid-js'
import { accountV1Logout } from '@/api'
import { router } from '@/router'
import { accountStore, setUser } from '@/routes/student/(account)/-store'
import { clearInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { clearCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'

export const logout = async () => {
  await accountV1Logout({ throwOnError: false })
  setUser(null)
  clearCachedStore()
  clearInfiniteStore()
  router.invalidate()
}

export const useTokenExpired = () => {
  const { t } = useTranslation()

  createEffect(() => {
    if (accountStore.user?.tokenExpires !== null) return

    untrack(() => {
      // not remove caches
      setUser(null)
      router.invalidate()
      showToast({
        title: t('Token Expired'),
        message: t('Your token has expired. Please login again.'),
        type: 'error',
        duration: 3000,
      })
    })
  })
}
