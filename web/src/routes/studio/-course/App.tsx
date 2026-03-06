import { Show } from 'solid-js'
import { type CourseSpec, studioV1GetCourse } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { EditingProvider, EMPTY_CONTENT_ID } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { PublishBadge } from '../-studio/PublishBadge'
import { Assessments } from './Assessments'
import { Categories } from './Categories'
import { Certificates } from './Certificates'
import { Course } from './Course'
import { CourseRelations } from './CourseRelations'
import { EmptyCourse } from './data'
import { Instructors } from './Instructors'
import { Lessons } from './Lessons'
import { Surveys } from './Surveys'

const restorableRegistry: Record<string, ContentEntry<CourseSpec>> = {}

export const App = (props: { id: string }) => {
  const { source, staging, fieldState, onSave, loading } = initEditing({
    restorableRegistry,
    id: props.id,
    cacheKey: 'studioV1GetCourse',
    emptyFactory: EmptyCourse,
    fetchFn: studioV1GetCourse,
  })

  return (
    <div class="py-4 relative space-y-8">
      <Show when={!loading()} fallback={<LoadingOverlay class="static" />}>
        <PublishBadge published={source.published} class="absolute -top-2 left-2" />
        <EditingProvider value={{ source, staging, fieldState }}>
          <Course onSave={onSave} />
          <Show when={props.id !== EMPTY_CONTENT_ID}>
            <Assessments />
            <Surveys />
            <Lessons />
            <Certificates />
            <Categories />
            <CourseRelations />
            <Instructors />
          </Show>
        </EditingProvider>
      </Show>
    </div>
  )
}
