import { createFileRoute } from '@tanstack/solid-router'
import { type MediaSpec, studioV1GetMedia } from '@/api'
import { EditingProvider } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { EmptyMedia } from './-data'
import { Media } from './-Media'
import { SubtitleSet } from './-SubtitleSet'

export const Route = createFileRoute('/studio/media/')({
  component: RouteComponent,
})

const restorableRegistry: Record<string, ContentEntry<MediaSpec>> = {}

function RouteComponent() {
  const { source, staging, fieldState, onSave } = initEditing({
    restorableRegistry,
    kind: 'media',
    cacheKey: 'studioV1GetMedia',
    emptyFactory: EmptyMedia,
    fetchFn: studioV1GetMedia,
  })

  return (
    <div class="max-w-4xl mx-auto py-4 relative space-y-8">
      <EditingProvider value={{ source, staging, fieldState }}>
        <Media onSave={onSave} />
        <SubtitleSet />
      </EditingProvider>
    </div>
  )
}
