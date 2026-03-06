import { Show } from 'solid-js'
import { type MediaSpec, studioV1DeleteMedia, studioV1GetMedia } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { EditingProvider, EMPTY_CONTENT_ID } from '../-context/editing'
import { type ContentEntry, initEditing } from '../-studio/initEditing'
import { PublishStatus } from '../-studio/PublishStatus'
import { EmptyMedia } from './data'
import { Media } from './Media'
import { SubtitleSet } from './SubtitleSet'

const restorableRegistry: Record<string, ContentEntry<MediaSpec>> = {}

export const App = (props: { id: string }) => {
  const { source, staging, fieldState, onSave, loading } = initEditing({
    restorableRegistry,
    id: props.id,
    cacheKey: 'studioV1GetMedia',
    emptyFactory: EmptyMedia,
    fetchFn: studioV1GetMedia,
  })

  return (
    <div class="py-4 relative space-y-8">
      <Show when={!loading()} fallback={<LoadingOverlay class="static" />}>
        <EditingProvider value={{ source, staging, fieldState }}>
          <PublishStatus class="mb-2" deleteFn={studioV1DeleteMedia} />
          <Media onSave={onSave} />
          <Show when={props.id !== EMPTY_CONTENT_ID}>
            <SubtitleSet />
          </Show>
        </EditingProvider>
      </Show>
    </div>
  )
}
