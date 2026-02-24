import { createEffect, createRoot, on, onCleanup } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'

export type CachedStoreState<T> = {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

export type CachedStoreActions<T> = {
  setStore: SetStoreFunction<CachedStoreState<T>>
  refetch: () => Promise<void>
}

export type CachedStoreReturn<T> = [CachedStoreState<T>, CachedStoreActions<T>]

const cache = new Map<string, CachedStoreState<unknown>>()

export const clearCachedStore = (): void => {
  cache.clear()
}

export const clearCachedStoreBy = (matcher: string | RegExp): void => {
  for (const key of cache.keys()) {
    const matches = typeof matcher === 'string' ? key.startsWith(matcher) : matcher.test(key)
    if (matches) cache.delete(key)
  }
}

const buildKey = (prefix: string, params: unknown): string => `${prefix}::${JSON.stringify(params)}`

export const initCachedStore = <T, P>(prefix: string, params: P, data?: T): void => {
  const key = buildKey(prefix, params)
  if (cache.has(key)) return
  cache.set(key, {
    data,
    loading: false,
    error: undefined,
  })
}

const emptyState = <T>(): CachedStoreState<T> => ({
  data: undefined,
  loading: false,
  error: undefined,
})

export const createCachedStore = <TData, TParams>(
  prefix: string,
  getParams: () => TParams | undefined,
  fetcher: (params: TParams) => Promise<TData>,
): CachedStoreReturn<TData> => {
  let store!: CachedStoreState<TData>
  let setStore!: SetStoreFunction<CachedStoreState<TData>>
  let actions!: CachedStoreActions<TData>

  const dispose = createRoot((dispose) => {
    const initialState: CachedStoreState<TData> = (() => {
      const params = getParams()
      if (!params) return emptyState<TData>()
      const key = buildKey(prefix, params)
      const cached = cache.get(key) as CachedStoreState<TData> | undefined
      return cached ? { data: cached.data, loading: cached.loading, error: cached.error } : emptyState<TData>()
    })()

    ;[store, setStore] = createStore<CachedStoreState<TData>>(initialState)

    let currentKey: string | undefined

    const load = async (params: TParams, key: string) => {
      setStore({ loading: true, error: undefined })
      try {
        const data = await fetcher(params)
        setStore({ data, loading: false })
        cache.set(key, { data, loading: false, error: undefined })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setStore({ loading: false, error })
        cache.set(key, { data: undefined, loading: false, error })
      }
    }

    const refetch = async () => {
      if (!currentKey) return
      const params = getParams()
      if (!params) return
      await load(params, currentKey)
    }

    const wrappedSetStore: SetStoreFunction<CachedStoreState<TData>> = ((...args: unknown[]) => {
      setStore(...(args as [never]))
      if (currentKey) {
        cache.set(currentKey, { data: store.data, loading: store.loading, error: store.error })
      }
    }) as SetStoreFunction<CachedStoreState<TData>>

    actions = {
      setStore: wrappedSetStore,
      refetch,
    }

    createEffect(
      on(
        getParams,
        (params) => {
          if (!params) {
            currentKey = undefined
            setStore(emptyState())
            return
          }

          const key = buildKey(prefix, params)
          if (key === currentKey) return
          currentKey = key

          const cached = cache.get(key) as CachedStoreState<TData> | undefined
          if (cached) {
            setStore({ data: cached.data, loading: cached.loading, error: cached.error })
          } else {
            load(params, key)
          }
        },
        { defer: false },
      ),
    )

    return dispose
  })

  onCleanup(dispose)

  return [store, actions]
}
