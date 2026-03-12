import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'
import { MARKETING_SITE_URL } from '@/config'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const hostname = location.hostname
    const subdomain = hostname.split('.')[0]

    if (subdomain === 'student') {
      throw redirect({ to: '/student', replace: true })
    } else if (subdomain === 'studio') {
      throw redirect({ to: '/studio', replace: true })
    } else if (subdomain === 'tutor') {
      throw redirect({ to: '/tutor', replace: true })
    } else if (MARKETING_SITE_URL) {
      location.href = MARKETING_SITE_URL
    } else {
      throw notFound()
    }
  },
})
