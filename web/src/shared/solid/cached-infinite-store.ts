import { createEffect, createRoot, createSignal, onCleanup, type Setter } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'

type PaginatedResponse<T> = {
  items: T[]
  count: number
  size: number
  page: number
  pages: number
}

type StoreState<T> = {
  items: T[]
  count: number
  page: number
  pages: number
  loading: boolean
  end: boolean
}

type StoreActions<T> = {
  loadMore: () => Promise<void>
  reset: () => void
  refetch: () => Promise<void>
  setStore: SetStoreFunction<StoreState<T>>
}

type StoreReturn<T> = [store: StoreState<T>, setObserverEl: Setter<HTMLElement | undefined>, actions: StoreActions<T>]

const cache = new Map<string, StoreState<unknown>>()

const buildKey = (prefix: string, params: unknown): string => {
  return `${prefix}::${JSON.stringify(params)}`
}

const noParams = <T>(): StoreState<T> => {
  return { items: [], count: 0, page: 0, pages: 0, loading: false, end: true }
}

const startFresh = <T>(): StoreState<T> => {
  return { items: [], count: 0, page: 0, pages: 0, loading: false, end: false }
}

export const clearInfiniteStore = (): void => {
  cache.clear()
}

export const initCachedInfiniteStore = <T, P>(
  prefix: string,
  params: P,
  data?: Partial<PaginatedResponse<T>>,
): void => {
  const key = buildKey(prefix, params)
  if (cache.has(key)) return
  cache.set(key, {
    items: data?.items ?? [],
    count: data?.count ?? 0,
    page: data?.page ?? 0,
    pages: data?.pages ?? 0,
    loading: false,
    end: true,
  })
}

export const clearCachedInfiniteStoreBy = (matcher: string | RegExp): void => {
  for (const key of cache.keys()) {
    const matches = typeof matcher === 'string' ? key.startsWith(matcher) : matcher.test(key)
    if (matches) cache.delete(key)
  }
}

export const createCachedInfiniteStore = <T, P>(
  prefix: string,
  getParams: () => P | undefined,
  fetcher: (params: P, page: number) => Promise<PaginatedResponse<T>>,
): StoreReturn<T> => {
  let state: StoreState<T>
  let setState: SetStoreFunction<StoreState<T>>
  let setObserver: Setter<HTMLElement | undefined>
  let ops: StoreActions<T>
  let activeKey: string | undefined
  let isInitialLoad = false

  const dispose = createRoot((dispose) => {
    ;[state, setState] = createStore(noParams<T>())
    const [obs, setObs] = createSignal<HTMLElement>()
    setObserver = setObs

    const writeCache = () => {
      if (!activeKey) return
      cache.set(activeKey, {
        items: [...state.items],
        count: state.count,
        page: state.page,
        pages: state.pages,
        loading: false,
        end: state.end,
      })
    }

    const loadMoreInternal = async (params: P) => {
      if (state.loading || state.end) return
      setState('loading', true)
      try {
        const nextPage = isInitialLoad ? 1 : state.page + 1
        const response = await fetcher(params, nextPage)
        setState({
          items: isInitialLoad ? response.items : [...state.items, ...response.items],
          count: response.count,
          page: response.page,
          pages: response.pages,
          loading: false,
          end: response.page >= response.pages,
        })
        writeCache()
      } catch (error) {
        setState('loading', false)
        throw error
      } finally {
        const wasInitialLoad = isInitialLoad
        isInitialLoad = false

        if (wasInitialLoad && !state.end) {
          queueMicrotask(() => {
            const el = obs()
            if (el) {
              const rect = el.getBoundingClientRect()
              const inViewport = rect.top < window.innerHeight && rect.bottom > 0
              if (inViewport && !state.loading && !state.end) {
                loadMore()
              }
            }
          })
        }
      }
    }

    const loadMore = async () => {
      const params = getParams()
      if (!params) return
      await loadMoreInternal(params)
    }

    const reset = () => {
      setState(noParams())
      if (activeKey) {
        cache.delete(activeKey)
        activeKey = undefined
      }
    }

    const refetch = async () => {
      const params = getParams()
      if (!params) return

      if (state.loading) return
      setState('loading', true)

      try {
        const response = await fetcher(params, 1)
        setState({
          items: response.items,
          count: response.count,
          page: response.page,
          pages: response.pages,
          loading: false,
          end: response.page >= response.pages,
        })
        writeCache()
      } catch (error) {
        setState('loading', false)
        throw error
      }
    }

    const wrappedSetStore: SetStoreFunction<StoreState<T>> = ((...args: unknown[]) => {
      setState(...(args as [never]))
      writeCache()
    }) as SetStoreFunction<StoreState<T>>

    ops = { loadMore, reset, refetch, setStore: wrappedSetStore }

    createEffect(() => {
      const params = getParams()
      if (!params) {
        activeKey = undefined
        setState(noParams())
        return
      }
      const key = buildKey(prefix, params)
      if (activeKey === key) return
      activeKey = key

      const saved = cache.get(key) as StoreState<T> | undefined
      if (saved) {
        setState({
          ...saved,
          items: [...saved.items],
        })
      } else {
        setState(startFresh())
        isInitialLoad = true
        loadMoreInternal(params)
      }
    })

    createEffect(() => {
      const el = obs()
      if (!el) return
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !isInitialLoad && !state.loading && !state.end) {
            loadMore()
          }
        },
        { threshold: 0.1 },
      )
      io.observe(el)
      onCleanup(() => io.disconnect())
    })

    return dispose
  })

  onCleanup(dispose)

  return [state!, setObserver!, ops!]
}
