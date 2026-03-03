import type { State } from '../-context/editing'

export type Paths<T, Depth extends number[] = []> = Depth['length'] extends 5
  ? never
  : T extends (infer Item)[]
    ? [number] | [number, ...Paths<Item, [0, ...Depth]>]
    : T extends object
      ? { [K in keyof T & string]: [K] | [K, ...Paths<T[K], [0, ...Depth]>] }[keyof T & string]
      : never

export type NestedValue<T, P extends readonly (string | number)[]> = P extends readonly [infer K, ...infer Rest]
  ? T extends (infer Item)[]
    ? Rest extends readonly (string | number)[]
      ? NestedValue<Item, Rest>
      : never
    : K extends keyof T
      ? Rest extends readonly (string | number)[]
        ? NestedValue<T[K], Rest>
        : T[K]
      : never
  : T

export const getNestedValue = <T, P extends Paths<T> | []>(obj: T, path: P): NestedValue<T, P> | undefined => {
  return path.reduce((cur, key) => (cur as Record<string | number, unknown> | undefined)?.[key], obj as unknown) as
    | NestedValue<T, P>
    | undefined
}

export const getNestedState = (fieldState: object, path: readonly (string | number)[]): unknown => {
  return path.reduce((cur, key) => (cur as Record<string | number, unknown> | undefined)?.[key], fieldState as unknown)
}

export const setNestedValue = <T extends object, P extends readonly [...Paths<T>]>(
  obj: T,
  path: P,
  value: NestedValue<T, P>,
) => {
  const target = path.slice(0, -1).reduce((cur, key, i) => {
    const record = cur as Record<string | number, unknown>
    if (record[key] === undefined || record[key] === null) {
      const nextKey = path[i + 1]
      record[key] = typeof nextKey === 'number' ? [] : {}
    }
    return record[key] as object
  }, obj as object)
  ;(target as Record<string | number, unknown>)[path[path.length - 1]!] = value
}

export const setNestedState = (fieldState: object, path: readonly (string | number)[], value: unknown): void => {
  const target = path.slice(0, -1).reduce((cur, key, i) => {
    const record = cur as Record<string | number, unknown>
    if (record[key] === undefined || record[key] === null) {
      const nextKey = path[i + 1]
      record[key] = typeof nextKey === 'number' ? [] : {}
    }
    return record[key] as object
  }, fieldState as object)
  ;(target as Record<string | number, unknown>)[path[path.length - 1]!] = value
}

export const checkTree = (node: unknown, exclude: Set<unknown>): { error: boolean; dirty: boolean } => {
  if (!node || typeof node !== 'object') return { error: false, dirty: false }
  if (exclude.has(node)) return { error: false, dirty: false }
  if ('error' in (node as object)) {
    const s = node as State
    return { error: !!s.error, dirty: s.dirty }
  }

  const result = { error: false, dirty: false }
  for (const val of Object.values(node)) {
    const r = checkTree(val, exclude)
    result.error ||= r.error
    result.dirty ||= r.dirty
    if (result.error && result.dirty) return result
  }
  return result
}

export const scrollToLastPaper = () => {
  requestAnimationFrame(() => {
    const papers = document.querySelectorAll('[data-paper]')
    const last = papers[papers.length - 1] as HTMLElement
    window.scrollTo({ top: last.getBoundingClientRect().top + window.scrollY - 200, behavior: 'smooth' })
  })
}
