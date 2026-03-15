import { createFileRoute } from '@tanstack/solid-router'
import { createResource, Show } from 'solid-js'
import * as v from 'valibot'
import { previewV1ExchangePreviewSession } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { setUser } from '../student/(account)/-store'

const searchSchema = v.object({
  next: v.optional(v.pipe(v.string(), v.startsWith('/'))),
})

export const Route = createFileRoute('/preview/$ott')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [session] = createResource(async () => {
    const { data } = await previewV1ExchangePreviewSession({ path: { ott: params().ott } })
    setUser(data)
    navigate({ to: search().next, replace: true })
  })

  return (
    <Show when={session.loading}>
      <LoadingOverlay />
    </Show>
  )
}
