import { For, Show } from 'solid-js'

interface WordFrequencyProps {
  frequencies: Record<string, number> | undefined
  minSize?: number
  maxSize?: number
}

const COLORS: readonly string[] = [
  '#c94444',
  '#2e9e96',
  '#2085a0',
  '#b8920f',
  '#4a3ab0',
  '#bb4d7a',
  '#009490',
  '#a81f66',
  '#4588c9',
  '#736bba',
  '#c25848',
  '#4e7ea0',
  '#78ab35',
  '#864e8a',
  '#ba7e28',
  '#559640',
  '#1a9694',
  '#1a7ab8',
  '#7a4db5',
  '#ba4a48',
] as const

export const WordFrequency = (props: WordFrequencyProps) => {
  const minSize = () => props.minSize ?? 14
  const maxSize = () => props.maxSize ?? 32

  const entries = () => {
    if (!props.frequencies) return []
    return Object.entries(props.frequencies)
  }

  const counts = () => entries().map(([, count]) => count)
  const maxCount = () => Math.max(...counts())
  const minCount = () => Math.min(...counts())
  const totalCount = () => counts().reduce((acc, count) => acc + count, 0)

  const getFontSize = (count: number): number => {
    if (maxCount() === minCount()) return minSize()
    const ratio = (count - minCount()) / (maxCount() - minCount())
    return minSize() + (maxSize() - minSize()) * ratio
  }

  const getColor = (index: number) => {
    return COLORS[index % COLORS.length]
  }

  const isHighFrequency = (count: number) => {
    return count > maxCount() * 0.7
  }

  return (
    <Show when={props.frequencies}>
      <div class="flex flex-wrap items-center gap-2">
        <For each={entries()}>
          {([word, count], index) => (
            <span
              class={` cursor-default ${isHighFrequency(count) ? 'font-bold' : ''}`}
              style={{ color: getColor(index()), 'font-size': `${getFontSize(count)}px`, 'line-height': 1 }}
            >
              {word}
              <span class="text-sm">({((count / totalCount()) * 100).toFixed(1)}%)</span>
            </span>
          )}
        </For>
      </div>
    </Show>
  )
}
