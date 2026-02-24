import { createFileRoute } from '@tanstack/solid-router'
import { type ExamSpec, studioV1GetExam } from '@/api'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { EmptyExam } from './-data'
import { Exam } from './-Exam'
import { QuestionPool } from './-QuestionPool'

export const Route = createFileRoute('/studio/exam/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<ExamSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'exam',
    cacheKey: 'studioV1GetExam',
    emptyFactory: EmptyExam,
    fetchFn: studioV1GetExam,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Exam onSave={onSave} />
        <CollapseProvider>
          <QuestionPool />
        </CollapseProvider>
      </EditingProvider>
    </div>
  )
}
