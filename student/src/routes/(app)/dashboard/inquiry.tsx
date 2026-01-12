import { createFileRoute } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { Inquiry } from '../-shared/Inquiry'

export const Route = createFileRoute('/(app)/dashboard/inquiry')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Show when={accountStore.user}>
      <Inquiry />
    </Show>
  )
}
