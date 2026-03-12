import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/student/(dashboard)/')({
  beforeLoad: () => {
    throw redirect({
      to: '/student/learning',
    })
  },
})
