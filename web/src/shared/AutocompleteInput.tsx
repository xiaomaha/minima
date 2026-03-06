import { debounce } from '@solid-primitives/scheduled'
import { IconSearch } from '@tabler/icons-solidjs'
import { getRegExp } from 'korean-regexp'
import { createEffect, createMemo, createSignal, For, type JSX, onCleanup, onMount, Show, untrack } from 'solid-js'

const OVERSCAN = 5
const DEFAULT_ITEM_HEIGHT = 32

interface Props {
  suggestions: string[]
  placeholder: string
  onCommit: (item: string) => void
  onInput?: (item: string) => void
  class?: string
  inputClass?: string
  dropdownClass?: string
  debounce?: number
  selectFirstOnCommit?: boolean
  clearInputOnCommit?: boolean
  autofocus?: boolean
  icon?: JSX.Element
  tabIndex?: number
  onFocus?: () => void
}

export const AutocompleteInput = (props: Props) => {
  const [input, setInput] = createSignal('')
  const [suggestions, setSuggestions] = createSignal<string[]>([])
  const [scrollTop, setScrollTop] = createSignal(0)
  const [itemHeight, setItemHeight] = createSignal(DEFAULT_ITEM_HEIGHT)
  const [rootHeight, setRootHeight] = createSignal(256)

  const handleKeyDown = (e: KeyboardEvent) => {
    // fix: in korean, checking e.isComposing is required
    if (e.key === 'Enter' && !e.isComposing) {
      commit()
    }
  }

  let dropdownRef: HTMLDivElement | undefined
  let inputRef: HTMLInputElement | undefined
  let measureRef: HTMLDivElement | undefined

  const virtualList = createMemo(() => {
    const total = suggestions().length
    const h = itemHeight()
    const rh = rootHeight()
    const start = Math.max(0, Math.floor(scrollTop() / h) - OVERSCAN)
    const end = Math.min(total, start + Math.ceil(rh / h) + OVERSCAN * 2)
    return {
      items: suggestions().slice(start, end),
      offsetY: start * h,
      totalHeight: total * h,
    }
  })

  createEffect(() => {
    if (suggestions().length > 0 && measureRef) {
      const h = measureRef.getBoundingClientRect().height
      if (h > 0) setItemHeight(h)
    }
  })

  const scheduledSetInput = debounce((value: string) => {
    setInput(value)
    props.onInput?.(value)
  }, props.debounce ?? 0)

  const handleInput = (e: InputEvent) => {
    dropdownRef?.classList.remove('dropdown-close')
    scheduledSetInput((e.target as HTMLInputElement).value.trim())
  }

  const handleFocus = () => {
    props.onFocus?.()
    // if (props.suggestions.length > 0 && suggestions().length < 1) {
    if (props.suggestions.length > 0) {
      dropdownRef?.classList.remove('dropdown-close')
      setScrollTop(0)
      if (listRef) listRef.scrollTop = 0
      setSuggestions(props.suggestions)
    }
  }

  createEffect(() => {
    // for lazy loading
    if (props.suggestions.length) {
      untrack(() => handleFocus())
    }
  })

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

    if (filtered?.length) setSuggestions(filtered)
  })

  let listRef: HTMLUListElement | undefined

  const commit = (item?: string) => {
    dropdownRef?.classList.add('dropdown-close')

    // reset scroll
    setScrollTop(0)
    if (listRef) listRef.scrollTop = 0

    let query: string
    if (item) {
      query = item
    } else if (props.selectFirstOnCommit && suggestions().length > 0) {
      query = suggestions()[0] ?? ''
    } else {
      query = input()
    }

    const cleaned = query.replace(/<[^>]*>/g, '').trim()
    inputRef!.value = cleaned
    props.onCommit(cleaned)
    if (props.clearInputOnCommit) {
      inputRef!.value = ''
      setInput('')
    }
    setSuggestions([])
  }

  onMount(() => {
    if (props.autofocus) {
      inputRef?.focus()
    }
  })

  return (
    <div ref={dropdownRef} class={`dropdown w-full ${props.class ?? ''}`}>
      <label class={`w-full input ${props.inputClass ?? ''}`} onclick={() => inputRef?.focus()}>
        <Show when={props.icon} fallback={<IconSearch class="cursor-pointer" />}>
          {props.icon}
        </Show>
        <input
          ref={inputRef}
          name="content-search"
          autocomplete="off"
          tabindex={props.tabIndex ?? 0}
          type="search"
          class="w-full ml-2"
          placeholder={props.placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
      </label>
      <div style={{ position: 'fixed', visibility: 'hidden', 'pointer-events': 'none' }}>
        <div ref={measureRef} class="text-sm/8 px-4">
          measure
        </div>
      </div>
      <Show when={suggestions().length}>
        <ul
          ref={(el) => {
            listRef = el
            const observer = new ResizeObserver(([entry]) => {
              if (entry) setRootHeight(entry.contentRect.height)
            })
            observer.observe(el)
            onCleanup(() => observer.disconnect())
          }}
          tabindex="-1"
          class={
            'max-h-68 mt-0.5 dropdown-content ml-0 menu rounded-box z-1 w-full p-2 ' +
            `shadow-lg opacity-100! transition-none! overflow-y-auto ${props.dropdownClass ?? ''}`
          }
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ position: 'relative', width: '100%', height: `${virtualList().totalHeight}px` }}>
            <div style={{ position: 'absolute', top: `${virtualList().offsetY}px`, width: '100%' }}>
              <For each={virtualList().items}>
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
            </div>
          </div>
        </ul>
      </Show>
    </div>
  )
}
