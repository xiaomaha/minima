export interface MediaPlayerAPI {
  duration: () => number
  jumpToTime: (time: number) => void
  onTimeUpdate: (callback: (time: number) => void) => void
  play: () => void
  pause: () => void
  isPlaying: () => boolean
}
