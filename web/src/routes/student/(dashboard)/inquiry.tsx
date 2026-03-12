import { createFileRoute } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { accountStore } from '@/routes/account/-store'
import { Inquiry } from '../-shared/Inquiry'
import { useDashboard } from './-context'

export const Route = createFileRoute('/student/(dashboard)/inquiry')({
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
