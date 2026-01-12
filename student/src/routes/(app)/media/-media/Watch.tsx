import { useTransContext } from '@mbarzda/solid-i18next'
import { IconPlayerSkipBack } from '@tabler/icons-solidjs'
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from 'solid-js'
import { type ContentV1UpdateMediaWatchData, contentV1GetMediaWatch, type WatchInSchema } from '@/api'
import { accessContext } from '@/context'
import { getProgress, setProgress } from '../../-shared/record'
import { getWatch, markWatched, setLastPosition, setWatch, type Watch as WatchCache } from './store'

interface Props {
  mediaId: string
  passingPoint: number | undefined
  duration: () => number
  currentTime: () => number
  jumpToTime: (time: number) => void
}

export const Watch = (props: Props) => {
  const [t] = useTransContext()
  const context = accessContext()

  // progress
  const [completed, setCompleted] = createSignal((getProgress(props.mediaId, context) ?? 0) >= 100)

  /**
   * setup
   * preparing watch data, syncing with server data
   */

  createEffect(async () => {
    const duration = Math.floor(props.duration())
    if (!duration) return

    const mediaId = props.mediaId
    let watch: WatchCache | null = null
    let lastPosition = -1

    // untrack watch, lastPosition
    untrack(() => {
      watch = getWatch(mediaId, context)
      if (watch) lastPosition = watch.lastPosition
    })

    if (watch) {
      if (lastPosition) props.jumpToTime(lastPosition)
      return
    }

    // self fixing watch bitmap
    const watchBits = new Array(duration).fill(false)

    // server data
    const { data } = await contentV1GetMediaWatch({ path: { id: props.mediaId }, throwOnError: false })
    // ignore maybe 404 error
    if (!data) {
      setWatch(mediaId, { lastPosition: 0, watchBits }, context)
      return
    }

    lastPosition = data.lastPosition
    if (lastPosition) props.jumpToTime(lastPosition)

    if (data.watchBits) {
      const bytes = Uint8Array.from(atob(data.watchBits), (char) => char.charCodeAt(0))
      const decompressed = strFromU8(gunzipSync(bytes))
      for (let i = 0; i < duration; i++) {
        watchBits[i] = decompressed[i] === '1'
      }
    }
    setWatch(props.mediaId, { lastPosition: data.lastPosition, watchBits }, context)
  })

  /**
   * progress
   * update watch bitmap
   */

  let lastPosition = -1
  createEffect(() => {
    const currentTime = Math.floor(props.currentTime())
    // debounce per second
    if (currentTime === lastPosition) return
    lastPosition = currentTime
    markWatched(props.mediaId, currentTime, context)
  })

  /**
   * cleanup
   * set last position
   */

  onCleanup(() => {
    const currentTime = props.currentTime()
    if (currentTime > 0) {
      setLastPosition(props.mediaId, currentTime, context)
    }
    saveWatch(props.mediaId, currentTime)
  })

  /**
   * auto save
   */

  createEffect(
    on(
      () => rate() >= 100,
      (isComplete, prev) => {
        if (isComplete && !prev) {
          saveWatch(props.mediaId, props.currentTime())
          setCompleted(true)
        }
      },
    ),
  )

  /**
   * update record score
   */
  createEffect(() => {
    setProgress(props.mediaId, rate(), context)
  })

  createEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveWatch(props.mediaId, props.currentTime())
      }
    }

    const handlePageHide = () => {
      saveWatch(props.mediaId, props.currentTime())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    onCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    })
  })

  const saveWatch = (mediaId: string, currentTime?: number) => {
    const data = getWatch(mediaId, context)
    if (!data) return

    const watch: WatchInSchema = {
      lastPosition: currentTime !== undefined ? currentTime : data.lastPosition,
    }

    if (data.watchBits && !completed()) {
      const watchString = data.watchBits.map((v) => (v ? '1' : '0')).join('')
      watch.watchBits = btoa(String.fromCharCode(...gzipSync(strToU8(watchString))))
    }

    if (!watch.watchBits && (!watch.lastPosition || watch.lastPosition <= 0)) return

    // for type checking
    const url: ContentV1UpdateMediaWatchData['url'] = `/api/v1/content/media/{id}/watch`
    const blob = new Blob([JSON.stringify(watch)], { type: 'application/json' })
    // Beacon doesn't follow app router, so pass access context manually
    navigator.sendBeacon(`${url.replace('{id}', mediaId)}?${context}`, blob)
  }

  /**
   * UI utils
   * watch bitmap segments
   */

  const segments = createMemo(() => {
    const result: Array<{ start: number; length: number }> = []
    const watch = getWatch(props.mediaId, context)
    if (!watch || !watch.watchBits?.length) return result

    let start = -1
    for (let i = 0; i < watch.watchBits.length; i++) {
      if (watch.watchBits[i]) {
        if (start === -1) start = i
      } else {
        if (start !== -1) {
          result.push({ start, length: i - start })
          start = -1
        }
      }
    }
    if (start !== -1) result.push({ start, length: watch.watchBits.length - start })
    return result
  })

  const rate = createMemo(() => {
    const watch = getWatch(props.mediaId, context)
    if (!watch || !watch.watchBits?.length) return 0
    const count = watch.watchBits.filter(Boolean).length
    return Math.min(100, (count / watch.watchBits.length) * 100)
  })

  const jumpToSkipped = () => {
    const watch = getWatch(props.mediaId, context)
    if (!watch || !watch.watchBits) return
    const skppedPosition = watch.watchBits.findIndex((v) => !v)
    props.jumpToTime(skppedPosition)
  }

  return (
    <div class="flex items-center gap-2 h-8">
      <div class="relative w-full h-1.5 bg-gray-300 rounded-full overflow-hidden">
        <For each={segments()}>
          {(segment) => (
            <div
              class={`absolute h-full ${rate() >= (props.passingPoint ?? 0) ? 'bg-green-600' : 'bg-red-500'}`}
              style={{
                left: `${(segment.start / props.duration()) * 100}%`,
                width: `${(segment.length / props.duration()) * 100}%`,
              }}
            />
          )}
        </For>
      </div>
      <Show when={!completed()}>
        <button type="button" class="h-8 btn btn-ghost btn-circle btn-sm" onClick={() => jumpToSkipped()}>
          <div class="tooltip" data-tip={t('Jump to skipped position')}>
            <IconPlayerSkipBack size={16} />
          </div>
        </button>
      </Show>
      <div class="font-mono text-right text-sm text-base-content/60 w-12 tooltip" data-tip={t('Watch percent')}>
        {rate().toFixed(1)}%
      </div>
    </div>
  )
}
