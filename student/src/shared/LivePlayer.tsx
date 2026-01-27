import { onCleanup, onMount } from 'solid-js'
import { LIVE_PLAYER_START_THRESHOLD_SECONDS } from '@/config'
import type { MediaPlayerAPI } from './MediaPlayerAPI'

interface Props {
  title: string
  url: string
  open: Date | string
  duration: number
  onReady?: (api: MediaPlayerAPI) => void
}

export const LivePlayer = (props: Props) => {
  const openTime = props.open instanceof Date ? props.open : new Date(props.open)
  const progressStartTimeMs = openTime.getTime() + LIVE_PLAYER_START_THRESHOLD_SECONDS * 1000
  const effectiveDurationSec = Math.max(0, props.duration - LIVE_PLAYER_START_THRESHOLD_SECONDS)

  const getElapsedTime = () => {
    const now = Date.now()
    const elapsed = Math.floor((now - progressStartTimeMs) / 1000)
    return Math.min(Math.max(0, elapsed), effectiveDurationSec)
  }

  let timeUpdateCallback: ((time: number) => void) | undefined

  onMount(() => {
    const now = Date.now()
    const endTimeMs = progressStartTimeMs + effectiveDurationSec * 1000
    const hasEnded = now >= endTimeMs

    if (!hasEnded) {
      const interval = setInterval(() => {
        const elapsed = getElapsedTime()
        timeUpdateCallback?.(elapsed)

        if (elapsed >= effectiveDurationSec) {
          clearInterval(interval)
        }
      }, 1000)

      onCleanup(() => clearInterval(interval))
    }

    const api: MediaPlayerAPI = {
      duration: () => effectiveDurationSec,
      jumpToTime: () => {},
      onTimeUpdate: (callback) => {
        timeUpdateCallback = callback
        queueMicrotask(() => callback(hasEnded ? effectiveDurationSec : getElapsedTime()))
      },
      play: () => {},
      pause: () => {},
      isPlaying: () => Date.now() < endTimeMs,
    }

    props.onReady?.(api)
  })

  return (
    <iframe
      title={props.title}
      src={props.url}
      class="w-full h-full"
      allow="camera; microphone; fullscreen; display-capture; autoplay"
    />
  )
}
