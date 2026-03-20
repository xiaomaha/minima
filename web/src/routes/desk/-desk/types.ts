import type { JSX } from 'solid-js'

export type ColumnDef<T = Record<string, unknown>> = {
  [K in keyof T & string]: {
    key: K
    label: string
    sortable?: boolean
    type?: 'number' | 'date' | 'datetime' | 'boolean' | 'badge' | 'badgeList' | 'thumbnail' | 'distanceToNow'
    render?: (value: T[K], row: T) => JSX.Element
    value?: (value: T[K], row: T) => unknown
  }
}[keyof T & string]

export type DetailFieldType =
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'badge'
  | 'badgeList'
  | 'thumbnail'
  | 'distanceToNow'
  | 'content'

export type DetailField<M> =
  | {
      [K in keyof M & string]: {
        key: K
        label: string
        type?: DetailFieldType
        render?: (value: M[K], row: M) => JSX.Element
      }
    }[keyof M & string]
  | {
      [K in keyof M & string]: M[K] extends (infer Item)[]
        ? {
            label: string
            array: K
            fields: {
              [FK in keyof Item & string]: {
                key: FK
                label: string
                type?: DetailFieldType
                render?: (value: Item[FK], row: Item) => JSX.Element
              }
            }[keyof Item & string][]
          }
        : never
    }[keyof M & string]

export type IdOf<T> = T extends { id: infer Id extends string | number } ? Id : string | number

export type TableConfig<T = Record<string, unknown>, D = T> = {
  title: string
  cacheKey: string
  fetcher: (options?: { query?: { page?: number; size?: number } }) => Promise<{
    data: { items: T[]; count: number; size: number; page: number; pages: number }
  }>
  columns: ColumnDef<T>[]
  searchable?: boolean
  detailFetcher?: (options: { path: { id: IdOf<T> } }) => Promise<{ data: D }>
  detail?: (DetailField<T> | DetailField<D>)[]
}
