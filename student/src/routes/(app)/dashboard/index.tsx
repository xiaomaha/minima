import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/(app)/dashboard/')({
  beforeLoad: () => {
    throw redirect({
      to: '/dashboard/learning',
    })
  },
})
