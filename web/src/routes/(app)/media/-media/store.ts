import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

export type Watch = {
  lastPosition: number
  watchBits?: boolean[]
}

interface WatchStore {
  [mediaId: string]: {
    [accessContext: string]: Watch
  }
}

export const { getWatch, setWatch, setLastPosition, markWatched } = createRoot(() => {
  const [store, setStore] = createStore<WatchStore>({})

  return {
    getWatch: (mediaId: string, ctx: string) => {
      return store[mediaId]?.[ctx] ?? null
    },
    setWatch: (mediaId: string, watch: Watch, ctx: string) => {
      if (!store[mediaId]) {
        setStore(mediaId, { [ctx]: watch })
        return
      }
      setStore(mediaId, ctx, watch)
    },
    setLastPosition: (mediaId: string, position: number, ctx: string) => {
      if (store[mediaId]?.[ctx]) {
        const lastPosition = store[mediaId][ctx].lastPosition
        if (lastPosition !== position) setStore(mediaId, ctx, 'lastPosition', position)
      }
    },
    markWatched: (mediaId: string, position: number, ctx: string) => {
      if (store[mediaId]?.[ctx]) {
        const watched = store[mediaId][ctx].watchBits?.[position]
        if (!watched) setStore(mediaId, ctx, 'watchBits', position, true)
      }
    },
  }
})
