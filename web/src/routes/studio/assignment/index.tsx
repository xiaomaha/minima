import { createFileRoute } from '@tanstack/solid-router'
import { type AssignmentSpec, studioV1GetAssignment } from '@/api'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { Assignment } from './-Assignment'
import { EmptyAssignment } from './-data'
import { QuestionPool } from './-QuestionPool'

export const Route = createFileRoute('/studio/assignment/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<AssignmentSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'assignment',
    cacheKey: 'studioV1GetAssignment',
    emptyFactory: EmptyAssignment,
    fetchFn: studioV1GetAssignment,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Assignment onSave={onSave} />
        <CollapseProvider>
          <QuestionPool />
        </CollapseProvider>
      </EditingProvider>
    </div>
  )
}
