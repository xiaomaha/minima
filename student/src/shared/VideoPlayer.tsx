import { onCleanup, onMount } from 'solid-js'
import 'plyr/dist/plyr.css'
import Plyr from 'plyr'

interface MediaPlayerAPI {
  duration: () => number
  jumpToTime: (time: number) => void
  onTimeUpdate: (callback: (time: number) => void) => void
}

interface Props {
  src: string
  onReady?: (api: MediaPlayerAPI) => void
  start?: number
}

export const VideoPlayer = (props: Props) => {
  let containerRef: HTMLDivElement | undefined
  let player: Plyr | undefined
  let apiReady = false

  const detectVideoType = (url: string): 'youtube' | 'vimeo' | 'video' => {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'youtube'
    }
    if (lowerUrl.includes('vimeo.com')) {
      return 'vimeo'
    }
    return 'video'
  }

  const checkAndNotifyReady = () => {
    if (apiReady || !player) return

    const duration = player.duration
    if (duration && !Number.isNaN(duration) && duration > 0) {
      apiReady = true

      const api: MediaPlayerAPI = {
        jumpToTime: (time: number) => {
          if (player) player.currentTime = time
        },
        onTimeUpdate: (callback: (time: number) => void) => {
          player?.on('timeupdate', () => {
            const currentTime = player?.currentTime
            if (currentTime !== undefined) callback(currentTime)
          })
        },
        duration: () => {
          return player?.duration ?? 0
        },
      }

      props.onReady?.(api)

      if (props.start)
        setTimeout(() => {
          if (player) player.currentTime = props.start!
        }, 100)
      player.muted = false
      player.play()
    }
  }

  onMount(() => {
    if (!containerRef) return

    const type = detectVideoType(props.src)

    if (type === 'video') {
      const video = document.createElement('video')
      video.src = props.src
      video.controls = true
      video.autoplay = true
      video.muted = false
      video.style.width = '100%'
      video.style.height = '100%'
      containerRef.appendChild(video)
      player = new Plyr(video, { ratio: '16:9' })
    } else {
      const div = document.createElement('div')
      div.setAttribute('data-plyr-provider', type)
      div.setAttribute('data-plyr-embed-id', props.src)
      containerRef.appendChild(div)
      player = new Plyr(div, { ratio: '16:9' })
    }

    player.on('ready', () => {
      checkAndNotifyReady()
    })

    player.on('loadedmetadata', () => {
      checkAndNotifyReady()
    })
  })

  onCleanup(() => {
    player?.destroy()
  })

  return <div class="h-full w-full" ref={containerRef} />
}
