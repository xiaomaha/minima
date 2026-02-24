import { createFileRoute } from '@tanstack/solid-router'
import { type SurveySpec, studioV1GetSurvey } from '@/api'
import { CollapseProvider } from '../-context/CollapseContext'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { EmptySurvey } from './-data'
import { QuestionPool } from './-QuestionPool'
import { Survey } from './-Survey'

export const Route = createFileRoute('/studio/survey/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<SurveySpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'survey',
    cacheKey: 'studioV1GetSurvey',
    emptyFactory: EmptySurvey,
    fetchFn: studioV1GetSurvey,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Survey onSave={onSave} />
        <CollapseProvider>
          <QuestionPool />
        </CollapseProvider>
      </EditingProvider>
    </div>
  )
}
