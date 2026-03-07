import { Show } from 'solid-js'
import { type AssignmentSpec, studioV1DeleteAssignment, studioV1GetAssignment } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider, EMPTY_CONTENT_ID } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { PublishStatus } from '../-studio/PublishStatus'
import { Assignment } from './Assignment'
import { EmptyAssignment } from './data'
import { QuestionPool } from './QuestionPool'
import { Rubric } from './Rubric'

const restorableRegistry: Record<string, ContentEntry<AssignmentSpec>> = {}

export const App = (props: { id: string }) => {
  const { source, staging, fieldState, onSave, loading } = initEditing({
    restorableRegistry,
    id: props.id,
    cacheKey: 'studioV1GetAssignment',
    emptyFactory: EmptyAssignment,
    fetchFn: studioV1GetAssignment,
  })

  return (
    <div class="py-4 relative space-y-8">
      <Show when={!loading()} fallback={<LoadingOverlay class="static" />}>
        <EditingProvider value={{ source, staging, fieldState }}>
          <PublishStatus class="mb-2" deleteFn={studioV1DeleteAssignment} />
          <Assignment onSave={onSave} />
          <Show when={props.id !== EMPTY_CONTENT_ID}>
            <Rubric />
            <CollapseProvider>
              <QuestionPool />
            </CollapseProvider>
          </Show>
        </EditingProvider>
      </Show>
    </div>
  )
}
