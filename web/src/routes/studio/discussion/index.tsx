import { createFileRoute } from '@tanstack/solid-router'
import { type DiscussionSpec, studioV1GetDiscussion } from '@/api'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { Discussion } from './-Discussion'
import { EmptyDiscussion } from './-data'
import { QuestionPool } from './-QuestionPool'

export const Route = createFileRoute('/studio/discussion/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<DiscussionSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'discussion',
    cacheKey: 'studioV1GetDiscussion',
    emptyFactory: EmptyDiscussion,
    fetchFn: studioV1GetDiscussion,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Discussion onSave={onSave} />
        <CollapseProvider>
          <QuestionPool />
        </CollapseProvider>
      </EditingProvider>
    </div>
  )
}
