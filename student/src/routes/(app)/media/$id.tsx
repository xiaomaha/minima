import { useTransContext } from '@mbarzda/solid-i18next'
import { createMediaQuery } from '@solid-primitives/media'
import { createElementSize } from '@solid-primitives/resize-observer'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, Match, Show, Suspense, Switch } from 'solid-js'
import * as v from 'valibot'
import { contentV1GetMedia, type MediaSchema } from '@/api'
import { accessContextParam } from '@/context'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { PdfViewer } from '@/shared/PdfViewer'
import { createResizable } from '@/shared/resizable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { VideoPlayer } from '@/shared/VideoPlayer'
import { Thread } from '../-shared/thread/Thread'
import { Note } from './-media/Note'
import { Subtitle } from './-media/Subtitle'
import { Watch } from './-media/Watch'

const searchSchema = v.object({
  start: v.optional(v.pipe(v.number())),
})

export const Route = createFileRoute('/(app)/media/$id')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

interface MediaPlayerAPI {
  jumpToTime: (time: number) => void
  onTimeUpdate: (callback: (time: number) => void) => void
  duration: () => number
}

function RouteComponent() {
  const [t] = useTransContext()
  const params = Route.useParams()
  const search = Route.useSearch()

  const [media] = createCachedStore(
    'contentV1GetMedia',
    () => ({ path: { id: params().id }, query: accessContextParam() }),
    async (options) => {
      const { data } = await contentV1GetMedia(options)
      return data
    },
  )

  const [currentTime, setCurrentTime] = createSignal(0)
  const [mediaAPI, setMediaAPI] = createSignal<MediaPlayerAPI>()

  const isLargeScreen = createMediaQuery('(min-width: 1024px)')

  const handlePlayerReady = (api: MediaPlayerAPI) => {
    setMediaAPI(api)
    api.onTimeUpdate(setCurrentTime)
  }

  const [contentContainerRef, setContentContainerRef] = createSignal<HTMLDivElement>()
  const size = createElementSize(contentContainerRef)

  const noteResizable = createResizable(() => 'note')
  // by media format
  const playerResizable = createResizable(() => media.data?.format)

  return (
    <div class="mx-auto flex max-w-460 flex-col lg:flex-row gap-x-4 gap-y-8">
      <div class="space-y-6 w-full md:min-w-160">
        <div class="relative">
          <div
            ref={setContentContainerRef}
            class="bg-base-content mb-2 w-full aspect-video rounded-xl overflow-hidden flex justify-center items-center"
            style={{ height: `${((size.width ?? 0) * 9) / 16 + playerResizable.heightOffset()}px` }}
          >
            <Show when={media.data}>
              {(m) => (
                <Switch>
                  <Match when={m().format === 'video'}>
                    <VideoPlayer src={m().url} onReady={handlePlayerReady} start={search().start} />
                  </Match>
                  <Match when={m().format === 'pdf'}>
                    <PdfViewer
                      duration={m().durationSeconds}
                      src={m().url}
                      onReady={handlePlayerReady}
                      start={search().start}
                    />
                  </Match>
                  {/* TODO each media format */}
                </Switch>
              )}
            </Show>
          </div>
          <Show when={media.data?.format === 'pdf'}>
            <playerResizable.Handle maxHeight={size.height ?? 0} />
          </Show>
        </div>
        <Show when={media.data}>
          {(m) => (
            <>
              <Watch
                mediaId={m().id}
                currentTime={currentTime}
                jumpToTime={(time) => mediaAPI()?.jumpToTime(time)}
                duration={() => mediaAPI()?.duration() ?? 0}
                passingPoint={m().passingPoint}
              />
              <InfoPanel media={m()} />

              <Show when={isLargeScreen() && (m().subtitleCount ?? 0) > 0}>
                <Suspense fallback={<LoadingOverlay class="static" />}>
                  <Subtitle
                    mediaId={m().id}
                    currentTime={currentTime}
                    jumpToTime={(time) => mediaAPI()?.jumpToTime(time)}
                  />
                </Suspense>
              </Show>
              <Show when={isLargeScreen()}>
                <Suspense>
                  <div class="mt-12">
                    <Thread
                      appLabel="content"
                      model="media"
                      subjectId={m().id}
                      title={m().title}
                      description={t('Write a comment about this content.')}
                      options={{
                        readOnly: false,
                        reply: true,
                        editorClass: 'min-h-20! max-h-50!',
                      }}
                    />
                  </div>
                </Suspense>
              </Show>
            </>
          )}
        </Show>
      </div>

      <div class="flex flex-col lg:max-w-100 w-full gap-y-8">
        <div class="relative">
          <Note mediaId={params().id} height={((size.width ?? 0) * 9) / 16 + noteResizable.heightOffset()} />
          <noteResizable.Handle maxHeight={size.height ?? 0} />
        </div>
      </div>
    </div>
  )
}

const InfoPanel = (props: { media: MediaSchema }) => {
  const [open, setOpen] = createSignal(false)
  return (
    <div class="collapse collapse-arrow bg-base-content/5">
      <input type="checkbox" checked={open()} onChange={(e) => setOpen(e.currentTarget.checked)} />
      <div class="flex gap-4 items-center collapse-title" classList={{ truncate: !open() }}>
        <Avatar user={props.media.owner} rounded />
        <div>
          <div class="font-bold line-clamp-1">{props.media.title}</div>
          <div class="text-sm">{props.media.owner.nickname || props.media.owner.name}</div>
        </div>
      </div>
      <Show when={props.media.description}>
        <ContentViewer content={props.media.description!} class="collapse-content text-sm" />
      </Show>
    </div>
  )
}
