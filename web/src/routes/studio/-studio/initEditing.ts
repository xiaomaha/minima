import { batch, createEffect, onCleanup, onMount } from 'solid-js'
import { createMutable, modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type { StudioV1ContentSuggestionsData } from '@/api'
import { createCachedStore, initCachedStore } from '@/shared/solid/cached-store'
import { EMPTY_CONTENT_ID, useContentSuggestion } from '../-context/ContentSuggestion'
import type { ContentType, FieldState } from '../-context/editing'

export type ContentEntry<T extends ContentType> = {
  source: T
  staging: T
}

type Kind = StudioV1ContentSuggestionsData['query']['kind']

interface Config<T extends ContentType> {
  restorableRegistry: Record<string, ContentEntry<T>>
  kind: Kind
  cacheKey: string
  emptyFactory: () => T
  fetchFn: (options: { path: { id: string } }) => Promise<{ data: T }>
}

export const initEditing = <T extends ContentType>(config: Config<T>) => {
  const { setKind, select, setSelect, setSuggestions } = useContentSuggestion()
  const { restorableRegistry } = config

  // autocomplete
  onMount(() => setKind(config.kind))

  // pre-populate new empty cache to avoid useless fetch
  initCachedStore(config.cacheKey, { path: { id: EMPTY_CONTENT_ID } }, config.emptyFactory())

  // server state
  const [rawSourceData] = createCachedStore(
    config.cacheKey,
    () => ({ path: { id: select[config.kind] } }),
    async (options) => (await config.fetchFn(options)).data,
  )

  // init edit staging
  const source = createMutable<T>(config.emptyFactory())
  const staging = createMutable<T>(config.emptyFactory())
  const fieldState = createMutable({} as FieldState<T>)

  createEffect(() => {
    const cur = rawSourceData.data?.id
    if (cur === undefined) return

    if (!restorableRegistry[cur]) {
      restorableRegistry[cur] = {
        source: structuredClone(unwrap(rawSourceData.data!)),
        staging: structuredClone(unwrap(rawSourceData.data!)),
      }
    }

    batch(() => {
      modifyMutable(source, reconcile(restorableRegistry[cur]!.source))
      modifyMutable(staging, reconcile(restorableRegistry[cur]!.staging))
      modifyMutable(fieldState, reconcile({} as FieldState<T>))
    })

    onCleanup(() => {
      restorableRegistry[cur]!.source = structuredClone(unwrap(source))
      restorableRegistry[cur]!.staging = structuredClone(unwrap(staging))
    })
  })

  const onSave = async (id: string) => {
    setSelect(config.kind, id)
    const suggestion = { id, title: (staging as { title: string }).title, modified: new Date().toISOString() }
    setSuggestions('data', (prev) => [suggestion, ...(prev?.filter((e) => e.id !== id) ?? [])])
  }

  return { source, staging, fieldState, onSave }
}
