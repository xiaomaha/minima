import { useNavigate } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import { contentV1SearchSuggestion } from '@/api'
import { SEARCH_SUGGESTION_DEBOUNCE } from '@/config'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'

export const SearchBox = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const hasIncompleteKorean = (str: string) => {
    const lastChar = str[str.length - 1]
    if (!lastChar) return false
    const code = lastChar.charCodeAt(0)
    return code >= 0x3131 && code <= 0x318e
  }

  const [input, setInput] = createSignal('')

  const [suggetions] = createCachedStore(
    'contentV1SearchSuggestion',
    () => {
      const input_ = input()
      if (!input_ || hasIncompleteKorean(input_)) return
      return { query: { q: input_, limit: 20 } }
    },
    async (options) => (await contentV1SearchSuggestion(options)).data,
  )

  const search = (q: string) => {
    navigate({ to: '/dashboard/search', search: { q } })
  }

  return (
    <AutocompleteInput
      suggestions={suggetions.data ?? []}
      placeholder={t('Search...')}
      onCommit={search}
      onInput={setInput}
      class="w-full max-w-100"
      inputClass="has-focus:input-primary rounded-full"
      dropdownClass="bg-base-200!"
      debounce={SEARCH_SUGGESTION_DEBOUNCE}
    />
  )
}
