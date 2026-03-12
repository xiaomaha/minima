import { redirect } from '@tanstack/solid-router'
import { accountStore } from './account/-store'

export const protectedRoute = () => {
  if (!accountStore.user) {
    const nextPath = location.pathname + location.search
    const shouldIgnoreNext = location.search.includes('token=')

    throw redirect({
      to: '/login',
      search: shouldIgnoreNext ? undefined : { next: nextPath },
    })
  }
}
