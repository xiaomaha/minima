import { useNavigate, useSearch } from '@tanstack/solid-router'
import { createEffect, untrack } from 'solid-js'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import type { TableConfig } from './types'

const DEFAULT_SIZE = 20

export const useTable = <T, D = Record<string, unknown>>(config: TableConfig<T, D>) => {
  const search = useSearch({ from: '/desk' })
  const navigate = useNavigate()

  const getSearch = () => search().search
  const getOrder = () => search().order
  const getPage = () => search().page ?? 1
  const getSize = () => search().size ?? DEFAULT_SIZE

  const setParams = (patch: { search?: string; order?: string; page?: number }) => {
    navigate({
      to: '.',
      search: (prev) => {
        const next = { ...prev, ...patch, page: patch.page ?? prev.page ?? 1 }
        if (!next.search) delete next.search
        if (!next.order) delete next.order
        return next
      },
    })
  }

  const setSearch = (value: string) => setParams({ search: value, page: 1 })

  const toggleSort = (key: string) => {
    setParams({ order: getOrder() === key ? '' : key, page: 1 })
  }

  const setPage = (page: number) => {
    setParams({ page })
    fetchPage(page)
  }

  const [data, _, { refetch, fetchPage }] = createCachedInfiniteStore(
    config.cacheKey,
    () => ({ search: getSearch(), order: getOrder() }),
    async (options, page) => (await config.fetcher({ query: { ...options, page, size: getSize() } })).data,
    () => getPage(),
  )

  let lastPageItems: T[] = []

  const pageItems = () => {
    const s = getSize()
    const p = getPage()
    const items = data.items.slice((p - 1) * s, p * s).filter(Boolean)
    if (!data.loading && data.count === 0) return []
    if (items.length > 0) lastPageItems = items
    return lastPageItems
  }

  createEffect(() => {
    const p = getPage()
    if (p !== data.page) {
      untrack(() => {
        fetchPage(p)
      })
    }
  })

  return { data, getSearch, getOrder, pageItems, getPage, setSearch, toggleSort, setPage, refetch }
}
