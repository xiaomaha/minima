import { debounce } from '@solid-primitives/scheduled'
import { IconSearch } from '@tabler/icons-solidjs'
import { getRegExp } from 'korean-regexp'
import { createEffect, createSignal, For, Show } from 'solid-js'

interface Props {
  suggestions: string[]
  placeholder: string
  onCommit: (item: string) => void
  onInput?: (item: string) => void
  suggestionCount?: number
  class?: string
  inputClass?: string
  dropdownClass?: string
  debounce?: number
  enterFirstSelect?: boolean
}

export const AutocompleteInput = (props: Props) => {
  const [input, setInput] = createSignal('')
  const [suggestions, setSuggestions] = createSignal<string[]>([])

  const handleKeyDown = (e: KeyboardEvent) => {
    // fix: in korean, checking e.isComposing is required
    if (e.key === 'Enter' && !e.isComposing) {
      commit()
    }
  }

  let dropdownRef: HTMLDivElement | undefined
  let inputRef: HTMLInputElement | undefined

  const scheduledSetInput = debounce((value: string) => {
    setInput(value)
    props.onInput?.(value)
  }, props.debounce ?? 0)

  const handleInput = (e: InputEvent) => {
    dropdownRef?.classList.remove('dropdown-close')
    scheduledSetInput((e.target as HTMLInputElement).value.trim())
  }

  const handleFocus = () => {
    if (props.suggestions.length > 0 && suggestions().length < 1) {
      dropdownRef?.classList.remove('dropdown-close')
      setSuggestions(props.suggestions)
    }
  }

  createEffect(() => {
    const query = input()
    if (!query) {
      setSuggestions([])
      return
    }
    const regex = getRegExp(input())
    if (!regex) return

    const filtered = props.suggestions.reduce((acc, item) => {
      const matched = item.match(regex)
      if (matched) {
        acc.push(item.replace(matched[0], `<span class="font-bold">$&</span>`))
      }
      return acc
    }, [] as string[])

    if (filtered?.length) setSuggestions(filtered.slice(0, props.suggestionCount ?? 10))
  })

  const commit = (item?: string) => {
    dropdownRef?.classList.add('dropdown-close')

    let query: string
    if (item) {
      query = item
    } else if (props.enterFirstSelect && suggestions().length > 0) {
      query = suggestions()[0] ?? ''
    } else {
      query = input()
    }

    const cleaned = query.replace(/<[^>]*>/g, '').trim()
    inputRef!.value = cleaned
    props.onCommit(cleaned)
    setSuggestions([])
  }

  return (
    <div ref={dropdownRef} class={`dropdown w-full ${props.class ?? ''}`}>
      <label class={`input ${props.inputClass ?? ''}`}>
        <IconSearch />
        <input
          ref={inputRef}
          name="content-search"
          autocomplete="off"
          tabindex="0"
          type="search"
          class="w-full"
          placeholder={props.placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
      </label>
      <Show when={suggestions().length}>
        <ul
          tabindex="-1"
          class={`dropdown-content menu rounded-box z-1 w-full p-2 shadow-lg opacity-100! transition-none! ${props.dropdownClass ?? ''}`}
        >
          <For each={suggestions()}>
            {(item) => (
              <li>
                <button
                  type="button"
                  class="line-clamp-1 py-0 text-sm/8"
                  onClick={(e) => commit(e.currentTarget.innerText)}
                >
                  <span innerHTML={item} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
