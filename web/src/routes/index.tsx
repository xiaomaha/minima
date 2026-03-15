import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'
import { MARKETING_SITE_URL } from '@/config'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const realm = location.hostname.split('.')[0]

    if (realm === 'student') {
      throw redirect({ to: '/student', replace: true })
    } else if (realm === 'studio') {
      throw redirect({ to: '/studio', replace: true })
    } else if (realm === 'tutor') {
      throw redirect({ to: '/tutor', replace: true })
    } else if (realm === 'desk') {
      throw redirect({ to: '/desk', replace: true })
    } else if (MARKETING_SITE_URL) {
      location.href = MARKETING_SITE_URL
    } else {
      throw notFound()
    }
  },
})
