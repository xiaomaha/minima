import { IconChevronsLeft, IconChevronsRight, IconDots, IconSearch } from '@tabler/icons-solidjs'
import { useSearch } from '@tanstack/solid-router'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Table } from './Table'
import type { IdOf, TableConfig } from './types'
import { useTable } from './useTable'

type Props<T, D> = {
  config: TableConfig<T, D>
}

export const Page = <T extends Record<string, unknown>, D extends Record<string, unknown>>(props: Props<T, D>) => {
  const { t } = useTranslation()
  const search = useSearch({ from: '/desk' })

  const table = useTable<T, D>(props.config)
  const totalPages = () => table.data.pages
  const currentPage = () => search().page ?? 1
  const [inputValue, setInputValue] = createSignal(table.getSearch() ?? '')

  const [selectedRow, setSelectedRow] = createSignal<T | null>(null)

  const [detailStore] = createCachedStore(
    props.config.cacheKey,
    () => {
      const row = selectedRow()
      if (!row || !props.config.detailFetcher) return undefined
      return { path: { id: row.id as string | number } }
    },
    async (options) => (await props.config.detailFetcher!(options as { path: { id: IdOf<T> } })).data,
  )

  const handleRowClick = (row: T) => {
    if (!props.config.detail) return
    setSelectedRow((prev) => (prev === row ? null : row))
  }

  const getPageNumbers = createMemo(() => {
    const total = totalPages()
    const current = currentPage()

    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1) as (number | '.')[]

    const pages: (number | '.')[] = []
    if (current <= 4) {
      pages.push(1, 2, 3, 4, 5, '.', total)
    } else if (current >= total - 3) {
      pages.push(1, '.', total - 4, total - 3, total - 2, total - 1, total)
    } else {
      pages.push(1, '.', current - 1, current, current + 1, '.', total)
    }

    return pages
  })

  return (
    <div class="flex flex-col gap-8">
      <div class="bg-base-100 sticky z-1 top-14 flex items-center justify-between">
        <Show when={props.config.searchable !== false}>
          <label class="input border-0 outline-0 shadow-none ml-3">
            <IconSearch class="cursor-pointer" />
            <input
              type="search"
              placeholder={t('Search...')}
              value={inputValue()}
              onInput={(e) => {
                setInputValue(e.currentTarget.value)
                if (!e.currentTarget.value) table.setSearch('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') table.setSearch(inputValue())
              }}
            />
          </label>
        </Show>
        <Show when={(table.data.count ?? 0) > 0}>
          <div class="flex items-center justify-between text-sm text-base-content/60 gap-4">
            <span>{t('{{count, number}} total', { count: table.data.count })}</span>
            <div class="join">
              <button
                type="button"
                class="join-item btn btn-sm p-1 min-w-8"
                disabled={currentPage() <= 1}
                onClick={() => table.setPage(currentPage() - 1)}
              >
                <IconChevronsLeft size={12} />
              </button>
              <For each={getPageNumbers()}>
                {(p) => (
                  <Show
                    when={p !== '.'}
                    fallback={
                      <button type="button" class="join-item btn btn-sm p-1 min-w-8 btn-disabled">
                        <IconDots size={16} />
                      </button>
                    }
                  >
                    <button
                      type="button"
                      class={`join-item btn btn-sm p-1 min-w-8 ${p === currentPage() ? 'btn-active' : ''}`}
                      onClick={() => table.setPage(p as number)}
                    >
                      {p}
                    </button>
                  </Show>
                )}
              </For>
              <button
                type="button"
                class="join-item btn btn-sm p-1 min-w-8"
                disabled={currentPage() >= totalPages()}
                onClick={() => table.setPage(currentPage() + 1)}
              >
                <IconChevronsRight size={12} />
              </button>
            </div>
          </div>
        </Show>
      </div>

      <Table<T, D>
        config={props.config}
        table={table}
        onRowClick={handleRowClick}
        selectedRow={selectedRow()}
        detailStore={detailStore}
      />
    </div>
  )
}
