import { For, Show } from 'solid-js'

interface WordFrequencyProps {
  frequencies: Record<string, number> | undefined
  minSize?: number
  maxSize?: number
}

const COLORS: readonly string[] = [
  '#ff6b6b',
  '#4ecdc4',
  '#45b7d1',
  '#f9ca24',
  '#6c5ce7',
  '#fd79a8',
  '#00cec9',
  '#e84393',
  '#74b9ff',
  '#a29bfe',
  '#fd7f6f',
  '#7eb0d3',
  '#b2e061',
  '#bd7ebe',
  '#ffb347',
  '#87d068',
  '#36cfc9',
  '#40a9ff',
  '#b37feb',
  '#ff7875',
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
