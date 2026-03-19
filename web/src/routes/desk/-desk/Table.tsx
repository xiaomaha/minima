import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-solidjs'
import { For, Index, Show } from 'solid-js'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { NoContent } from '@/shared/NoContent'
import { useTranslation } from '@/shared/solid/i18n'
import { Detail } from './Detail'
import { renderValue } from './helper'
import type { DetailField, TableConfig } from './types'
import type { useTable } from './useTable'

type Props<T, D = Record<string, unknown>> = {
  config: TableConfig<T, D>
  table: ReturnType<typeof useTable<T, D>>
  onRowClick?: (row: T) => void
  selectedRow?: T | null
  detailStore?: { data: D | undefined }
}

export const Table = <T extends Record<string, unknown>, D extends Record<string, unknown> = Record<string, unknown>>(
  props: Props<T, D>,
) => {
  const { t } = useTranslation()
  const { config, table } = props

  const SortIcon = (key: string) => {
    const order = table.getOrder()
    if (order === key) return <IconChevronUp size={14} />
    if (order === `-${key}`) return <IconChevronDown size={14} />
    return <IconSelector size={14} class="opacity-30" />
  }

  const mergedDetail = (row: T) => {
    if (props.selectedRow !== row) return null
    return { ...row, ...props.detailStore?.data } as T & D
  }

  return (
    <div class="overflow-x-auto">
      <table class="table text-sm w-full">
        <thead class="[&_th]:whitespace-nowrap [&_th]:font-normal">
          <tr classList={{ invisible: table.data.loading }}>
            <th></th>
            <For each={config.columns}>
              {(col) => (
                <th>
                  <Show when={col.sortable} fallback={col.label}>
                    <button
                      type="button"
                      class="flex items-center gap-1 cursor-pointer select-none"
                      onClick={() => table.toggleSort(col.key)}
                    >
                      {col.label}
                      {SortIcon(col.key)}
                    </button>
                  </Show>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <Show when={!table.data.count && !table.data.loading}>
            <tr>
              <td colspan={config.columns.length} class="text-center py-8">
                <NoContent message={t('No results found')} />
              </td>
            </tr>
          </Show>

          <Show when={table.data.loading}>
            <LoadingOverlay />
          </Show>

          <Index each={table.pageItems()}>
            {(row, i) => (
              <>
                <tr
                  class="hover:bg-base-200 [&_td]:py-1"
                  classList={{ 'cursor-pointer': !!config.detail }}
                  onClick={() => props.onRowClick?.(row())}
                >
                  <td class="tabular-nums h-12.5">{table.data.count - i - (table.data.page - 1) * table.data.size}</td>
                  <For each={config.columns}>
                    {(col) => {
                      const v = () => (col.value ? col.value(row()[col.key], row()) : row()[col.key])
                      return (
                        <td>
                          {col.render ? col.render!(v() as T[keyof T & string], row()) : renderValue(v(), col.type)}
                        </td>
                      )
                    }}
                  </For>
                </tr>
                <Show when={config.detail && mergedDetail(row())}>
                  {(data) => (
                    <tr class="bg-base-content/40">
                      <td colspan={config.columns.length + 1} class="w-0 p-0 border-none">
                        <Detail data={data()} fields={config.detail as DetailField<T & D>[]} />
                      </td>
                    </tr>
                  )}
                </Show>
              </>
            )}
          </Index>
        </tbody>
      </table>
    </div>
  )
}
