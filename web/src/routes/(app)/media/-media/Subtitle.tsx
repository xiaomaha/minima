import { debounce } from '@solid-primitives/scheduled'
import { IconSearch } from '@tabler/icons-solidjs'
import { getRegExp } from 'korean-regexp'
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { contentV1GetSubtitles, type SubtitleSchema } from '@/api'
import { getPreferences, setPreferences } from '@/routes/(app)/account/-store'
import { CopyButton } from '@/shared/CopyButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  mediaId: string
  currentTime: () => number
  jumpToTime: (time: number) => void
}

interface Cue {
  startSecond: number
  timeDisplay: string
  texts: Map<string, string>
}

export const Subtitle = (props: Props) => {
  const { t } = useTranslation()

  const [subtitles] = createCachedStore(
    'contentV1GetSubtitles',
    () => ({ path: { id: props.mediaId } }),
    async (options) => {
      const { data } = await contentV1GetSubtitles(options)
      return data
    },
  )

  const [userScrolling, setUserScrolling] = createSignal(false)
  const [cues, setCues] = createSignal<Cue[]>([])
  const [languages, setLanguages] = createSignal<string[]>([])
  const [selectedLangs, setSelectedLangs] = createSignal<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = createSignal('')

  let lastPosition = -1
  let wrapperRef: HTMLDivElement | undefined
  let prevActiveElement: HTMLElement | null = null

  const subtitleEnabled = () => getPreferences().subtitlesEnabled ?? true
  const setSubtitleEnabled = (enabled: boolean) => setPreferences('subtitlesEnabled', enabled)
  const autoScrollEnabled = () => getPreferences().subtitleAutoScroll ?? true
  const setAutoScrollEnabled = (enabled: boolean) => setPreferences('subtitleAutoScroll', enabled)

  createEffect(() => {
    if (subtitles.data) {
      setCues(parseSubtitles(subtitles.data))
      const langs = [...new Set(subtitles.data.map((d) => d.lang))]
      setLanguages(langs)
      setSelectedLangs(new Set(langs))
    }
  })

  const filteredCues = createMemo(() => {
    const query = searchQuery()
    if (!query) return cues()

    const regex = getRegExp(query)
    return cues().filter((cue) => {
      return Array.from(cue.texts.values()).some((text) => regex.test(text))
    })
  })

  const throttledCurrentTime = createMemo(() => Math.floor(props.currentTime()))

  const visibleCues = createMemo(() => {
    const position = throttledCurrentTime()
    const filtered = filteredCues()

    if (filtered.length === 0) return []

    const activeIndex = filtered.findLastIndex((cue) => cue.startSecond <= position)

    if (activeIndex === -1) {
      return filtered.slice(0, 100)
    }

    const buffer = 50
    const start = Math.max(0, activeIndex - buffer)
    const end = Math.min(filtered.length, activeIndex + buffer + 50)

    return filtered.slice(start, end)
  })

  createEffect(() => {
    const position = throttledCurrentTime()

    if (position === lastPosition) return
    lastPosition = position

    const allCues = filteredCues()
    if (allCues.length === 0) return

    if (prevActiveElement) {
      prevActiveElement.classList.remove('active', 'bg-info/10')
      prevActiveElement = null
    }

    const activeCue = allCues.findLast((cue) => cue.startSecond <= position)

    if (activeCue && wrapperRef) {
      const activeElement = wrapperRef.querySelector(`[data-start="${activeCue.startSecond}"]`) as HTMLElement
      if (activeElement) {
        activeElement.classList.add('active', 'bg-info/10')
        prevActiveElement = activeElement

        if (autoScrollEnabled() && !userScrolling()) {
          const wrapperRect = wrapperRef.getBoundingClientRect()
          const activeRect = activeElement.getBoundingClientRect()
          const offset = activeRect.top - wrapperRect.top - wrapperRect.height / 2 + activeRect.height / 2

          wrapperRef.scrollTo({
            top: wrapperRef.scrollTop + offset,
            behavior: 'smooth',
          })
        }
      }
    }
  })

  const resetUserScrolling = debounce(() => setUserScrolling(false), 2000)

  createEffect(() => {
    if (wrapperRef && autoScrollEnabled()) {
      const handleUserScroll = () => {
        setUserScrolling(true)
        resetUserScrolling()
      }

      wrapperRef.addEventListener('wheel', handleUserScroll)
      wrapperRef.addEventListener('touchmove', handleUserScroll)

      onCleanup(() => {
        wrapperRef?.removeEventListener('wheel', handleUserScroll)
        wrapperRef?.removeEventListener('touchmove', handleUserScroll)
        resetUserScrolling.clear()
      })
    }
  })

  onCleanup(() => {
    prevActiveElement = null
  })

  const toggleLanguage = (lang: string, checked: boolean) => {
    setSelectedLangs((prev) => {
      const next = new Set(prev)
      checked ? next.add(lang) : next.delete(lang)
      return next
    })
  }

  const copyToClipboard = (cue: Cue, e: MouseEvent) => {
    e.stopPropagation()

    const texts = Array.from(cue.texts.entries())
      .filter(([lang]) => selectedLangs().has(lang))
      .map(([, text]) => text)
      .join(' - ')
    const content = `${cue.timeDisplay} - ${texts}`
    navigator.clipboard.writeText(content)
    window.dispatchEvent(new CustomEvent('clipboardwrite', { detail: { text: content } }))
  }

  const moveToCueTime = (cue: Cue) => {
    props.jumpToTime(cue.startSecond)
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const regex = getRegExp(query)
    return text.replace(regex, (match) => `<mark class="bg-yellow-200">${match}</mark>`)
  }

  const debouncedSearch = debounce((value: string) => {
    setSearchQuery(value)
  }, 50)

  const searchSubtitles = (e: Event) => {
    debouncedSearch((e.currentTarget as HTMLInputElement).value.trim())
  }

  const toggleSubtitleEnabled = () => {
    setSubtitleEnabled(!subtitleEnabled())
  }

  return (
    <div class="flex flex-col w-full flex-1 max-h-116">
      <Show when={subtitles.data}>
        <div class="flex gap-4 mb-3 justify-end">
          <Show when={subtitleEnabled()}>
            <For each={languages()}>
              {(lang) => (
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary checkbox-sm"
                    value={lang}
                    checked={selectedLangs().has(lang)}
                    onChange={(e) => toggleLanguage(lang, e.target.checked)}
                  />
                  <span class="font-semibold">{t(lang)}</span>
                </label>
              )}
            </For>
            <label class="input">
              <IconSearch size={16} />
              <input type="search" class="grow" placeholder={t('Search')} onInput={searchSubtitles} />
            </label>
            <div class="flex-1" />
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                class="toggle toggle-xs"
                checked={!!autoScrollEnabled()}
                onChange={() => setAutoScrollEnabled(!autoScrollEnabled())}
              />
              <span class="text-sm">{t('Auto Scroll')}</span>
            </label>
          </Show>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="toggle toggle-xs" checked={!!subtitleEnabled()} onChange={toggleSubtitleEnabled} />
            <span class="text-sm">{t('Subtitle Enabled')}</span>
          </label>
        </div>

        <Show when={subtitleEnabled()}>
          <div
            class={
              '[&>div]:flex [&>div]:items-center [&>div]:px-4 [&>div]:py-0.5 [&>div]:gap-3 [&>div:hover]:bg-base-content/5' +
              ' [&>div]:transition-colors [&>div]:duration-300' +
              ' h-full overflow-y-auto rounded-lg border border-base-content/10 cursor-pointer'
            }
            ref={wrapperRef}
          >
            <For each={visibleCues()}>
              {(cue) => (
                <div data-start={cue.startSecond} onclick={() => moveToCueTime(cue)} class="h-9">
                  <div class="text-xs font-mono">{cue.timeDisplay}</div>
                  <div class={`gap-3 flex-1 grid grid-cols-1 md:grid-cols-${selectedLangs().size}`}>
                    <For each={Array.from(selectedLangs())}>
                      {(lang) => (
                        <div
                          class="text-sm flex items-center"
                          data-lang={lang}
                          innerHTML={highlightText(cue.texts.get(lang) ?? '', searchQuery())}
                        />
                      )}
                    </For>
                  </div>
                  <CopyButton onCopy={(e) => copyToClipboard(cue, e)} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

const parseSubtitles = (apiData: SubtitleSchema[]): Cue[] => {
  const cuesBySecond = new Map<number, Map<string, string>>()

  apiData.forEach((item) => {
    const lines = item.body.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim()
      if (!line || !line.includes('-->')) continue

      const startTime = line.split('-->')[0]?.trim() ?? ''
      const startSecond = Math.floor(toSeconds(startTime))

      i++
      const text = lines[i]?.trim() ?? ''

      if (text) {
        if (!cuesBySecond.has(startSecond)) {
          cuesBySecond.set(startSecond, new Map([['__timeDisplay__', startTime]]))
        }
        cuesBySecond.get(startSecond)!.set(item.lang, text)
      }
    }
  })

  return Array.from(cuesBySecond.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([startSecond, texts]) => {
      const timeDisplay = texts.get('__timeDisplay__') ?? ''
      texts.delete('__timeDisplay__')

      return {
        startSecond,
        timeDisplay: timeDisplay.split('.')[0] || timeDisplay,
        texts,
      }
    })
}

const toSeconds = (time: string): number => {
  const parts = time.split(':').map(parseFloat)
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0)
  }
  return parts[0] || 0
}
