import { createFileRoute } from '@tanstack/solid-router'
import { type QuizSpec, studioV1GetQuiz } from '@/api'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { EmptyQuiz } from './-data'
import { QuestionPool } from './-QuestionPool'
import { Quiz } from './-Quiz'
export const Route = createFileRoute('/studio/quiz/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<QuizSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'quiz',
    cacheKey: 'studioV1GetQuiz',
    emptyFactory: EmptyQuiz,
    fetchFn: studioV1GetQuiz,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Quiz onSave={onSave} />
        <CollapseProvider>
          <QuestionPool />
        </CollapseProvider>
      </EditingProvider>
    </div>
  )
}
