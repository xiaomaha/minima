import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/(app)/dashboard/achievement')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/dashboard/achievement"!</div>
}
