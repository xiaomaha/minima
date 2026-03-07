import { useNavigate, useParams } from '@tanstack/solid-router'
import { batch, createEffect, onCleanup } from 'solid-js'
import { createMutable, modifyMutable, reconcile, unwrap } from 'solid-js/store'
import { clearCachedInfiniteStoreBy } from '@/shared/solid/cached-infinite-store'
import { clearCachedStoreBy, createCachedStore, initCachedStore } from '@/shared/solid/cached-store'
import { type ContentType, EMPTY_CONTENT_ID, type FieldState } from '../-context/editing'

export type ContentEntry<T extends ContentType> = {
  source: T
  staging: T
}

interface Config<T extends ContentType> {
  restorableRegistry: Record<string, ContentEntry<T>>
  id: string
  cacheKey: string
  emptyFactory: () => T
  fetchFn: (options: { path: { id: string } }) => Promise<{ data: T }>
}

export const initEditing = <T extends ContentType>(config: Config<T>) => {
  const { restorableRegistry, id } = config
  const params = useParams({ from: '/studio/$app/$id' })
  const navigate = useNavigate()

  // pre-populate new empty cache to avoid useless fetch
  initCachedStore(config.cacheKey, { path: { id: EMPTY_CONTENT_ID } }, config.emptyFactory())

  // server state
  const [rawSourceData] = createCachedStore(
    config.cacheKey,
    () => ({ path: { id } }),
    async (options) => (await config.fetchFn(options)).data,
  )

  createEffect(() => {
    if (rawSourceData.error?.status === 404) {
      navigate({ to: '/studio/$app/$id', params: { ...params(), id: EMPTY_CONTENT_ID } })
    }
  })

  // init edit staging
  const source = createMutable<T>(config.emptyFactory())
  const staging = createMutable<T>(config.emptyFactory())
  const fieldState = createMutable({} as FieldState<T>)

  createEffect(() => {
    if (!rawSourceData.data) return

    const cur = rawSourceData.data.id
    if (cur === undefined) return

    let curRegistry = restorableRegistry[cur]

    if (!curRegistry) {
      curRegistry = restorableRegistry[cur] = {
        source: structuredClone(unwrap(rawSourceData.data)),
        staging: structuredClone(unwrap(rawSourceData.data)),
      }
    }

    batch(() => {
      modifyMutable(source, reconcile(curRegistry.source))
      modifyMutable(staging, reconcile(curRegistry.staging))
      modifyMutable(fieldState, reconcile({} as FieldState<T>))
    })

    onCleanup(() => {
      curRegistry.source = structuredClone(unwrap(source))
      curRegistry.staging = structuredClone(unwrap(staging))
    })
  })

  const onSave = async (id: string) => {
    if (staging.id === EMPTY_CONTENT_ID) {
      clearCachedStoreBy('studioV1Content')
      clearCachedInfiniteStoreBy('studioV1Content')

      batch(() => {
        initCachedStore(config.cacheKey, { path: { id } }, structuredClone(unwrap({ ...staging, id })))
        modifyMutable(staging, reconcile(structuredClone(config.emptyFactory())))
      })
    }
  }

  return { source, staging, fieldState, onSave, loading: () => rawSourceData.loading }
}
