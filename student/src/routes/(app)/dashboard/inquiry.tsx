import { createFileRoute } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { Inquiry } from '../-shared/Inquiry'
import { useDashboard } from './-context'

export const Route = createFileRoute('/(app)/dashboard/inquiry')({
  component: RouteComponent,
})

function RouteComponent() {
  const { setRefreshHandler } = useDashboard()

  return (
    <Show when={accountStore.user}>
      <Inquiry setRefreshHandler={setRefreshHandler} />
    </Show>
  )
}
