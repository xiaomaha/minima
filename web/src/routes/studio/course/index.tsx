import { createFileRoute } from '@tanstack/solid-router'
import { type CourseSpec, studioV1GetCourse } from '@/api'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { Course } from './-Course'
import { EmptyCourse } from './-data'

export const Route = createFileRoute('/studio/course/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<CourseSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'course',
    cacheKey: 'studioV1GetCourse',
    emptyFactory: EmptyCourse,
    fetchFn: studioV1GetCourse,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Course onSave={onSave} />
      </EditingProvider>
    </div>
  )
}
