import { IconPlus } from '@tabler/icons-solidjs'
import { createMemo, createSignal, type JSX } from 'solid-js'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { createCachedStore } from '@/shared/solid/cached-store'

interface AutocompleteOption<T extends number | string> {
  id: T
  label: string
  itemType?: {
    appLabel: string
    model: string
  }
}

interface Props<T extends number | string, P = void> {
  onCommit: (suggestion: AutocompleteOption<T>) => void
  cacheKey: string
  fetchParams: () => P
  fetchFn: (params: P) => Promise<AutocompleteOption<T>[] | undefined>
  excludeIds?: () => T[]
  placeholder?: string
  class?: string
  inputClass?: string
  icon?: JSX.Element
}

export const InlineSuggestion = <T extends number | string, P = void>(props: Props<T, P>) => {
  const [touched, setTouched] = createSignal(false)

  const [suggestions] = createCachedStore(
    props.cacheKey,
    () => (touched() ? (props.fetchParams() ?? ({} as P)) : undefined),
    async (params) => props.fetchFn(params),
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.label, data])))

  const cleanedSuggestionList = createMemo(() => {
    const ids = props.excludeIds?.() ?? []
    if (!ids.length) return suggestions.data?.map((s) => s.label) ?? []
    const filtered = suggestions.data?.filter((suggestion) => !ids.includes(suggestion.id))
    return filtered?.map((s) => s.label) ?? []
  })

  const onCommit = (suggestion: string) => {
    const item = suggestionMap()[suggestion]
    if (item === undefined) return
    props.onCommit(item)
    setTouched(false)
  }

  return (
    <div class="relative w-full">
      <AutocompleteInput
        suggestions={cleanedSuggestionList()}
        placeholder={props.placeholder ?? ''}
        onCommit={onCommit}
        dropdownClass="bg-base-200! max-h-100 overflow-y-auto flex-nowrap z-10"
        inputClass={`outline-0 border-none shadow-none max-w-xs hover:bg-base-200 ${props.inputClass ?? ''}`}
        selectFirstOnCommit
        clearInputOnCommit
        class={`mr-auto dropdown-top ${props.class ?? ''}`}
        icon={props.icon ?? <IconPlus size={20} class="cursor-pointer shrink-0" />}
        onFocus={() => setTouched(true)}
        tabIndex={-1}
      />
    </div>
  )
}
