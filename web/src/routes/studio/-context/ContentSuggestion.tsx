import {
  type Accessor,
  createContext,
  createMemo,
  createRoot,
  createSignal,
  type ParentComponent,
  type Setter,
  useContext,
} from 'solid-js'
import { createStore, type SetStoreFunction, type Store } from 'solid-js/store'
import { type ContentSuggestionSpec, type StudioV1ContentSuggestionsData, studioV1ContentSuggestions } from '@/api'
import { createCachedStore } from '@/shared/solid/cached-store'

export const EMPTY_CONTENT_ID = ''

type Kind = StudioV1ContentSuggestionsData['query']['kind']

type ContentSuggestionContextType = {
  kind: Accessor<Kind | undefined>
  setKind: Setter<Kind | undefined>
  select: Store<Record<Kind, string>>
  setSelect: SetStoreFunction<Record<Kind, string>>
  setSuggestions: SetStoreFunction<{ data: ContentSuggestionSpec[] | undefined }>
  suggestionList: Accessor<string[]>
}

const ContentSuggestionContext = createContext<ContentSuggestionContextType>()

const { select, setSelect } = createRoot(() => {
  const [select, setSelect] = createStore<Record<StudioV1ContentSuggestionsData['query']['kind'], string>>({
    exam: EMPTY_CONTENT_ID,
    survey: EMPTY_CONTENT_ID,
    quiz: EMPTY_CONTENT_ID,
    assignment: EMPTY_CONTENT_ID,
    discussion: EMPTY_CONTENT_ID,
    media: EMPTY_CONTENT_ID,
    course: EMPTY_CONTENT_ID,
  })
  return { select, setSelect }
})

export const ContentSuggestionProvider: ParentComponent = (props) => {
  const [kind, setKind] = createSignal<StudioV1ContentSuggestionsData['query']['kind'] | undefined>()

  const [suggestions, { setStore: setSuggestions }] = createCachedStore(
    'studioV1GetExamSuggestions',
    () => (kind() ? { query: { kind: kind()! } } : undefined),
    async (options) => (await studioV1ContentSuggestions(options)).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.id, data])))

  const suggestionList = createMemo(() =>
    Object.values(suggestionMap()).map(
      (data) => `${data.title.trim()} - ${new Date(data.modified).toLocaleString()} - ${data.id}`,
    ),
  )

  const value = {
    kind,
    setKind,
    select,
    setSelect,
    setSuggestions,
    suggestionList,
  }

  return <ContentSuggestionContext.Provider value={value}>{props.children}</ContentSuggestionContext.Provider>
}

export const useContentSuggestion = () => {
  const ctx = useContext(ContentSuggestionContext)
  if (!ctx) throw new Error('useSuggestion must be used within Provider')
  return ctx
}
