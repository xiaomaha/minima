import { IconChevronLeft, IconFileSpark, IconHome, IconSearch } from '@tabler/icons-solidjs'
import { useNavigate, useParams, useRouter } from '@tanstack/solid-router'
import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { type StudioV1ContentSuggestionsData, studioV1ContentSuggestions } from '@/api'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'
import { EMPTY_CONTENT_ID } from '../-context/editing'

type Props = {
  class?: string
}

export const Menu = (props: Props) => {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams({ from: '/studio/$app/$id' })
  const navigate = useNavigate()

  const [suggestions] = createCachedStore(
    'studioV1ContentSuggestions',
    () => ({ query: { kind: params().app as StudioV1ContentSuggestionsData['query']['kind'] } }),
    async (options) => (await studioV1ContentSuggestions(options)).data,
  )

  const suggestionMap = createMemo(() =>
    Object.fromEntries((suggestions.data ?? []).map((data) => [data.title, data.id])),
  )

  const suggestionList = createMemo(() => {
    return suggestions.data?.map((suggestion) => suggestion.title) ?? []
  })

  const [searchOpen, setSearchOpen] = createSignal(false)

  const select = (key: string) => {
    const id = suggestionMap()[key]
    navigate({ to: `/studio/${params().app}/${id}` })
  }

  return (
    <>
      <div
        class={`flex items-center gap-6 opacity-40 hover:opacity-100 [&:has(*:hover)]:opacity-100 ${props.class ?? ''}`}
      >
        <div class="breadcrumbs text-sm">
          <ul>
            <li>{t(capitalize(params().app))}</li>
            <li>{params().id === EMPTY_CONTENT_ID ? t('New content') : params().id}</li>
          </ul>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle"
          onClick={() => setSearchOpen(true)}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          <IconSearch class="shrink-0" />
        </button>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle"
          onClick={() => navigate({ to: `/studio/${params().app}/new` })}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          <IconFileSpark class="shrink-0" />
        </button>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle"
          onClick={() => router.history.back()}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          <IconChevronLeft class="shrink-0" />
        </button>

        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle"
          onClick={() => {
            navigate({ to: '/studio' })
          }}
        >
          <IconHome class="shrink-0" />
        </button>
      </div>

      <SearchBox
        suggestions={suggestionList()}
        placeholder={t('Select content')}
        onCommit={select}
        open={searchOpen()}
        setOpen={setSearchOpen}
      />
    </>
  )
}

interface SearchProps {
  suggestions: string[]
  placeholder: string
  onCommit: (item: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SearchBox = (props: SearchProps) => {
  let previousFocus: HTMLElement | null = null

  const onCommit = (item: string) => {
    props.setOpen(false)
    props.onCommit(item)
    // scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  createEffect(() => {
    if (props.open) {
      previousFocus = document.activeElement as HTMLElement
    } else if (previousFocus) {
      previousFocus.focus()
      previousFocus = null
    }
  })

  return (
    <dialog class="modal items-start pt-20" open={props.open}>
      <Show when={props.open}>
        <form method="dialog" class="modal-backdrop" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => props.setOpen(false)} onMouseDown={(e) => e.preventDefault()} />
        </form>
        <div class="modal-box p-0 relative overflow-y-visible max-w-2xl">
          <AutocompleteInput
            suggestions={props.suggestions}
            placeholder={props.placeholder}
            onCommit={onCommit}
            dropdownClass="bg-base-200! max-h-100 overflow-y-auto flex-nowrap"
            inputClass="input-lg outline-0 rounded-xl border-base-100"
            selectFirstOnCommit
            suggestionCount={20}
            class="text-center"
            autofocus
            icon={<IconSearch size={32} />}
          />
        </div>
      </Show>
    </dialog>
  )
}
