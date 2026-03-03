import { useNavigate, useParams } from '@tanstack/solid-router'
import { batch, createEffect, onCleanup } from 'solid-js'
import { createMutable, modifyMutable, reconcile, unwrap } from 'solid-js/store'
import { createCachedStore, initCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
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
  const { t } = useTranslation()
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
    // TODO
    // const suggestion = { id, title: staging.title, modified: new Date().toISOString() }
    // setSuggestions('data', (prev) => [suggestion, ...(prev?.filter((e) => e.id !== id) ?? [])])

    if (staging.id === EMPTY_CONTENT_ID) {
      batch(() => {
        initCachedStore(config.cacheKey, { path: { id } }, structuredClone(unwrap({ ...staging, id })))
        modifyMutable(staging, reconcile(structuredClone(config.emptyFactory())))
      })
    }
  }

  const onCopy = async () => {
    if (staging.id === EMPTY_CONTENT_ID) return
    restorableRegistry[EMPTY_CONTENT_ID] = {
      source: structuredClone(unwrap(config.emptyFactory())),
      staging: structuredClone(
        unwrap({
          ...staging,
          id: EMPTY_CONTENT_ID,
          title: t('Copy of {{title}}', { title: staging.title }),
          thumbnail: undefined,
        }),
      ),
    }
    navigate({ to: '/studio/$app/$id', params: { ...params(), id: EMPTY_CONTENT_ID } })
  }

  return { source, staging, fieldState, onSave, onCopy, loading: () => rawSourceData.loading }
}
