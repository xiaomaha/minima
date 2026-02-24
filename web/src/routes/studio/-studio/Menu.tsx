import { IconFileSpark, IconSearch } from '@tabler/icons-solidjs'
import { createEffect, createSignal, Show } from 'solid-js'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useContentSuggestion } from '../-context/ContentSuggestion'

type Props = {
  class?: string
}

export const Menu = (props: Props) => {
  const { t } = useTranslation()

  const { kind, select, setSelect, suggestionList } = useContentSuggestion()

  const [searchOpen, setSearchOpen] = createSignal(false)

  const handleCommit = (key: string) => {
    if (!kind()) return
    const parts = key.split(' - ')
    const kindId = parts.at(-1)!
    setSelect(kind()!, kindId)
  }

  const handleNew = () => {
    if (!kind()) return
    setSelect(kind()!, EMPTY_CONTENT_ID)
  }

  return (
    <>
      <div class={`flex items-center gap-4 opacity-40 hover:opacity-100 [&:has(*:hover)]:opacity-100 ${props.class ?? ''}`}>
        <div class="text-sm text-end">{select[kind()!]}</div>
        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle outline-non"
          onClick={() => setSearchOpen(true)}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          <IconSearch />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost outline-none"
          onClick={handleNew}
          onMouseDown={(e) => e.preventDefault()}
          tabIndex={-1}
        >
          <IconFileSpark />
        </button>
      </div>

      <SearchBox
        suggestions={suggestionList()}
        placeholder={t('Select content')}
        onCommit={handleCommit}
        open={searchOpen()}
        setOpen={setSearchOpen}
      />
    </>
  )
}

interface SearchProps {
  buttonClass?: string
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
            enterFirstSelect
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
