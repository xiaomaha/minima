import { Show } from 'solid-js'
import { type QuizSpec, studioV1DeleteQuiz, studioV1GetQuiz } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider, EMPTY_CONTENT_ID } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { PublishStatus } from '../-studio/PublishStatus'
import { EmptyQuiz } from './data'
import { QuestionPool } from './QuestionPool'
import { Quiz } from './Quiz'

const restorableRegistry: Record<string, ContentEntry<QuizSpec>> = {}

export const App = (props: { id: string }) => {
  const { source, staging, fieldState, onSave, loading } = initEditing({
    restorableRegistry,
    id: props.id,
    cacheKey: 'studioV1GetQuiz',
    emptyFactory: EmptyQuiz,
    fetchFn: studioV1GetQuiz,
  })

  return (
    <div class="py-4 relative space-y-8">
      <Show when={!loading()} fallback={<LoadingOverlay class="static" />}>
        <EditingProvider value={{ source, staging, fieldState }}>
          <PublishStatus class="mb-2" deleteFn={studioV1DeleteQuiz} />
          <Quiz onSave={onSave} />
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
