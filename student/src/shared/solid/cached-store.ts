import { createEffect, createRoot, on } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'

export type CachedStoreState<T> = {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

type CachedStoreReturn<T> = [
  store: CachedStoreState<T>,
  actions: {
    refetch: () => Promise<void>
    setStore: SetStoreFunction<CachedStoreState<T>>
  },
]

const storeCache = new Map<string, CachedStoreReturn<unknown>>()

export const clearStore = () => {
  storeCache.clear()
}

const getCacheKey = (key: string, params: unknown): string => {
  return `${key}_${JSON.stringify(params)}`
}

export const createCachedStore = <TData, TParams>(
  key: string,
  getParams: () => TParams | undefined,
  fetcher: (params: TParams) => Promise<TData>,
): CachedStoreReturn<TData> => {
  let store: CachedStoreState<TData>
  let setStore: SetStoreFunction<CachedStoreState<TData>>
  let actions: CachedStoreReturn<TData>[1]
  let currentCacheKey: string | undefined

  createRoot(() => {
    ;[store, setStore] = createStore<CachedStoreState<TData>>({
      data: undefined,
      loading: false,
      error: undefined,
    })

    const updateCache = (cacheKey: string) => {
      storeCache.set(cacheKey, [
        { data: store.data, loading: store.loading, error: store.error },
        actions,
      ] as CachedStoreReturn<unknown>)
    }

    const load = async (params: TParams) => {
      const cacheKey = getCacheKey(key, params)
      setStore({ loading: true, error: undefined })

      try {
        const data = await fetcher(params)
        setStore({ data, loading: false })
        updateCache(cacheKey)
      } catch (err) {
        setStore({
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      }
    }

    const refetch = async () => {
      const params = getParams()
      if (!params) return
      await load(params)
    }

    createEffect(
      on(
        getParams,
        (params) => {
          if (!params) {
            currentCacheKey = undefined
            setStore({
              data: undefined,
              loading: false,
              error: undefined,
            })
            return
          }

          const cacheKey = getCacheKey(key, params)
          if (currentCacheKey === cacheKey) return
          currentCacheKey = cacheKey

          const cached = storeCache.get(cacheKey)
          if (cached) {
            const cachedTyped = cached as CachedStoreReturn<TData>
            const [cachedStore] = cachedTyped
            setStore({
              data: cachedStore.data,
              loading: cachedStore.loading,
              error: cachedStore.error,
            })
          } else {
            setStore({
              // data: undefined, use stale data to avoid flickering
              loading: false,
              error: undefined,
            })
            load(params)
          }
        },
        { defer: false },
      ),
    )

    const wrappedSetStore: SetStoreFunction<CachedStoreState<TData>> = ((...args: unknown[]) => {
      setStore(...(args as [never]))
      if (currentCacheKey) {
        updateCache(currentCacheKey)
      }
    }) as SetStoreFunction<CachedStoreState<TData>>

    actions = { refetch, setStore: wrappedSetStore }
  })

  return [store!, actions!]
}
