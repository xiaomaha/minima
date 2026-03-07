import { Show } from 'solid-js'
import { type ExamSpec, studioV1DeleteExam, studioV1GetExam } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider, EMPTY_CONTENT_ID } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { PublishStatus } from '../-studio/PublishStatus'
import { EmptyExam } from './data'
import { Exam } from './Exam'
import { QuestionPool } from './QuestionPool'

const restorableRegistry: Record<string, ContentEntry<ExamSpec>> = {}

export const App = (props: { id: string }) => {
  const { source, staging, fieldState, onSave, loading } = initEditing({
    restorableRegistry,
    id: props.id,
    cacheKey: 'studioV1GetExam',
    emptyFactory: EmptyExam,
    fetchFn: studioV1GetExam,
  })

  return (
    <div class="py-4 relative space-y-8">
      <Show when={!loading()} fallback={<LoadingOverlay class="static" />}>
        <EditingProvider value={{ source, staging, fieldState }}>
          <PublishStatus class="mb-2" deleteFn={studioV1DeleteExam} />
          <Exam onSave={onSave} />
          <Show when={props.id !== EMPTY_CONTENT_ID}>
            <CollapseProvider>
              <QuestionPool />
            </CollapseProvider>
          </Show>
        </EditingProvider>
      </Show>
    </div>
  )
}
