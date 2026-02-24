import { createMediaQuery } from '@solid-primitives/media'
import { createElementSize } from '@solid-primitives/resize-observer'
import { IconChevronRight } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, For, Match, Show, Suspense, Switch } from 'solid-js'
import * as v from 'valibot'
import { contentV1GetMedia, type MediaSchema } from '@/api'
import { accessContextParam } from '@/context'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { LivePlayer } from '@/shared/LivePlayer'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import type { MediaPlayerAPI } from '@/shared/MediaPlayerAPI'
import { PdfViewer } from '@/shared/PdfViewer'
import { createResizable } from '@/shared/resizable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { VideoPlayer } from '@/shared/VideoPlayer'
import { ProgressBar } from '../-shared/ProgressBar'
import { QuizDialog } from '../-shared/quiz/QuizDialog'
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

function RouteComponent() {
  const { t } = useTranslation()
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

  const ratio = () => (media.data?.format === 'pdf' ? 1 : 9 / 16)

  return (
    <div class="mx-auto flex max-w-460 flex-col lg:flex-row gap-x-4 gap-y-8">
      <div class="space-y-6 w-full md:min-w-160">
        <div class="relative">
          <div
            ref={setContentContainerRef}
            class="bg-base-content mb-2 w-full aspect-video rounded-xl overflow-hidden flex justify-center items-center max-h-[calc(100svh-150px)]"
            style={{ height: `${(size.width ?? 0) * ratio() + playerResizable.heightOffset()}px` }}
          >
            <Show when={media.data}>
              {(m) => (
                <Switch>
                  <Match when={m().format === 'video'}>
                    <VideoPlayer src={m().url} onReady={handlePlayerReady} start={search().start} />
                  </Match>
                  <Match when={m().format === 'pdf'}>
                    <PdfViewer duration={m().durationSeconds} src={m().url} onReady={handlePlayerReady} />
                  </Match>
                  {/* TODO each media format */}
                  <Match when={m().format === 'live'}>
                    <LivePlayer
                      title={m().title}
                      url={m().url}
                      duration={m().durationSeconds}
                      open={new Date(m().open)}
                      onReady={handlePlayerReady}
                    />
                  </Match>
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
                isLive={m().format === 'live'}
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

        <Show when={media.data?.quizzes.length}>
          <Quizzes quizzes={media.data!.quizzes!} player={mediaAPI()} mediaId={params().id} />
        </Show>
      </div>
    </div>
  )
}

interface QuizzesProps {
  quizzes: MediaSchema['quizzes']
  player: MediaPlayerAPI | undefined
  mediaId: string
}

const Quizzes = (props: QuizzesProps) => {
  const { t } = useTranslation()
  const [activeQuiz, setActiveQuiz] = createSignal<string>()

  let wasPlaying = false

  const handleOpen = (quizId: string) => {
    wasPlaying = props.player?.isPlaying() ?? false
    setActiveQuiz(quizId)
    props.player?.pause()
  }

  const handleClose = () => {
    setActiveQuiz(undefined)
    if (wasPlaying) props.player?.play()
  }

  return (
    <For each={props.quizzes}>
      {(quiz, i) => (
        <>
          <div class="card shadow-sm relative overflow-hidden cursor-pointer" onclick={() => handleOpen(quiz.id)}>
            <div class="flex justify-between items-center gap-4">
              <div class="card-body">
                <div class="space-x-4 flex items-center">
                  <div class="badge badge-neutral">{t('Quiz {{num}}', { num: i() + 1 })}</div>
                  <div class="label flex-1 flex justify-between">
                    {t('{{count}} Question', { count: quiz.questionCount })}
                  </div>
                </div>
                <div class="card-title text-lg/snug">{quiz.title}</div>
              </div>
              <IconChevronRight class="m-4 shrink-0" />
            </div>
            <ProgressBar
              contentId={quiz.id}
              passingPoint={quiz.passingPoint}
              class="absolute bottom-0 left-0 w-full h-1.25 rounded-none"
            />
          </div>
          <Show when={activeQuiz() === quiz.id}>
            <QuizDialog
              id={quiz.id}
              open={!!activeQuiz()}
              onClose={() => handleClose()}
              inlineContext={{ media: props.mediaId }}
            />
          </Show>
        </>
      )}
    </For>
  )
}

const InfoPanel = (props: { media: MediaSchema }) => {
  const { t } = useTranslation()
  const [open, setOpen] = createSignal(false)

  return (
    <div class="collapse collapse-arrow bg-base-content/5">
      <input type="checkbox" checked={open()} onChange={(e) => setOpen(e.currentTarget.checked)} />
      <div class="flex gap-4 items-center collapse-title">
        <Avatar user={props.media.owner} rounded />
        <div>
          <div class="label text-xs flex gap-2">
            <Show when={props.media.license}>
              <span>{props.media.license}</span>
            </Show>
            <Show when={props.media.channel}>
              <span>{t('by {{channel}}', { channel: props.media.channel })}</span>
            </Show>
          </div>
          <div class="font-bold">
            <Show when={props.media.format === 'live'}>
              <span class="badge badge-sm bg-red-600 text-base-100 mr-2 my-0">{t('Live')}</span>
            </Show>
            {props.media.title}
          </div>
          <div class="text-sm">{props.media.owner.nickname || props.media.owner.name}</div>
        </div>
      </div>
      <Show when={props.media.description}>
        <ContentViewer content={props.media.description!} class="collapse-content text-sm" />
      </Show>
    </div>
  )
}
