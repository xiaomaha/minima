import { IconDownload, IconRotate, IconUpload, IconX } from '@tabler/icons-solidjs'
import Papa from 'papaparse'
import { createMemo, type JSX, Show } from 'solid-js'
import { modifyMutable, reconcile, unwrap } from 'solid-js/store'
import type { GenericSchema, InferOutput } from 'valibot'
import * as v from 'valibot'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { forceDownload } from '@/shared/utils'
import { type ContentType, useEditing } from '../-context/editing'
import { checkArrayLengths, checkTree, getNestedState, getNestedValue, type Paths, setNestedState } from './helper'

interface Props<TSchema extends GenericSchema = GenericSchema> {
  rootKey?: Paths<ContentType> | []
  excludeKeys?: Paths<ContentType>[]
  label?: string
  schema: TSchema

  children: (
    status: {
      IsDirty: () => JSX.Element
      HasError: () => JSX.Element
    },
    actions: {
      Export: ({ label }: { label?: string }) => JSX.Element
      Import: ({ label }: { label?: string }) => JSX.Element
      Reset: ({ label }: { label?: string }) => JSX.Element
      Save: ({
        label,
        onSave,
      }: {
        label?: string
        onSave: (data: InferOutput<TSchema>) => Promise<void>
      }) => JSX.Element
      Remove: ({ onRemove }: { onRemove: () => Promise<number | undefined> }) => JSX.Element
    },
  ) => JSX.Element
}

export const DataAction = <TSchema extends GenericSchema = GenericSchema>(props: Props<TSchema>) => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing()

  const excludeSet = createMemo(() => new Set(props.excludeKeys?.map((path) => getNestedState(fieldState, path)) ?? []))

  const treeState = createMemo(() => {
    if (props.rootKey === undefined) return { error: false, dirty: false }
    const node = props.rootKey.length === 0 ? fieldState : getNestedState(fieldState, props.rootKey)
    const sourceNode = props.rootKey.length === 0 ? source : getNestedValue(source, props.rootKey)
    const stagingNode = props.rootKey.length === 0 ? staging : getNestedValue(staging, props.rootKey)
    const tree = checkTree(node, excludeSet())
    const lengthDirty = checkArrayLengths(sourceNode, stagingNode, excludeSet(), node)
    return { ...tree, dirty: tree.dirty || lengthDirty }
  })

  const isDirty = () => treeState().dirty
  const hasError = () => treeState().error

  const updateFieldState = () => {
    const result = buildFieldState(source, staging, props.schema, props.excludeKeys, props.rootKey)

    const applyDirtyOnly = (fieldStateNode: unknown, resultNode: unknown): void => {
      if (!resultNode || typeof resultNode !== 'object') return
      if ('dirty' in (resultNode as object)) {
        const leaf = fieldStateNode as { dirty: boolean; error: string } | undefined
        if (leaf && typeof leaf === 'object' && 'dirty' in leaf) {
          leaf.dirty = (resultNode as { dirty: boolean }).dirty
          leaf.error = (resultNode as { error: string }).error
        }
        return
      }
      if (Array.isArray(fieldStateNode) && Array.isArray(resultNode)) {
        fieldStateNode.splice(resultNode.length)
      }
      for (const key of Object.keys(resultNode as object)) {
        applyDirtyOnly((fieldStateNode as Record<string, unknown>)?.[key], (resultNode as Record<string, unknown>)[key])
      }
    }

    if (!props.rootKey || props.rootKey.length === 0) {
      applyDirtyOnly(fieldState, result)
    } else {
      const current = getNestedState(fieldState, props.rootKey)
      applyDirtyOnly(current, result)
    }
  }

  const status = {
    IsDirty: () => (
      <Show when={isDirty()}>
        <div class="status status-warning  tooltip" data-tip={t('Editing in progress')} />
      </Show>
    ),
    HasError: () => (
      <Show when={hasError()}>
        <div class="status status-error tooltip" data-tip={t('Error')} />
      </Show>
    ),
  }

  const reset = async () => {
    const rootKey = props.rootKey

    const applyExcludes = (val: object, baseKey: (string | number)[]) => {
      if (!props.excludeKeys?.length) return
      for (const excludePath of props.excludeKeys) {
        const relative = excludePath.slice(baseKey.length)
        if (relative.length === 0) continue
        const currentVal = getNestedState(staging, excludePath)
        setNestedState(val, relative, currentVal)
      }
    }

    if (!rootKey || rootKey.length === 0) {
      const val = structuredClone(unwrap(source))
      applyExcludes(val, [])
      modifyMutable(staging, reconcile(val))
    } else {
      const target = getNestedValue(staging, rootKey)
      const val = structuredClone(unwrap(getNestedValue(source, rootKey))) as object
      applyExcludes(val, rootKey)
      modifyMutable(target, reconcile(val))
    }

    updateFieldState()
  }

  const save = async (onSave: (data: InferOutput<TSchema>) => Promise<void>) => {
    const rootKey = props.rootKey
    const target = rootKey && rootKey.length > 0 ? getNestedValue(staging, rootKey as Paths<ContentType>) : staging
    const result = v.safeParse(props.schema, target)

    if (!result.success) {
      showToast({
        title: t('Save failed'),
        message: result.issues
          .map(
            (i) =>
              `${
                i.path
                  ?.map((o) => o.key)
                  .join('.')
                  .replaceAll('.', ' ') ?? t('Error')
              }: ${i.message}`,
          )
          .join('\n'),
        type: 'error',
        duration: 1000 * 60,
      })
      return
    }

    staging.modified = new Date().toISOString()
    await onSave(result.output)

    showToast({
      title: t('Save successful'),
      message: '',
      type: 'success',
      duration: 1000 * 3,
    })
    updateFieldState()
  }

  const exportCSV = async () => {
    const csv = Papa.unparse(
      flattenBySchema(getNestedValue(staging, props.rootKey as Paths<ContentType>), props.schema),
    )
    forceDownload(csv, 'text/csv', `${props.label}-${new Date().toISOString()}.csv`)
  }

  const importCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'text/csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const { data: csvData } = Papa.parse(text, { header: true })

      const imported = unflattenBySchema(csvData, props.schema)
      const result = v.safeParse(props.schema, imported)

      if (!result.success) {
        showToast({
          title: t('Import failed'),
          message: result.issues
            .map(
              (i) =>
                `${
                  i.path
                    ?.map((o) => o.key)
                    .join('.')
                    .replaceAll('.', ' ') ?? t('Error')
                }: ${i.message}`,
            )
            .join('\n'),
          type: 'error',
          duration: 1000 * 600,
        })
        return
      }

      const rootKey = props.rootKey

      if (rootKey && rootKey.length > 0) {
        const target = getNestedValue(staging, rootKey as Paths<ContentType>)

        if (Array.isArray(target)) {
          const existing = new Set(target.map((item) => JSON.stringify(item)))
          target.push(...(result.output as []).filter((item) => !existing.has(JSON.stringify(item))))
        } else {
          const merged = smartMerge(target, result.output as Partial<typeof target>, props.schema)
          modifyMutable(target, reconcile(merged))
        }
      } else {
        const merged = smartMerge(staging, result.output as Partial<typeof staging>, props.schema)
        modifyMutable(staging, reconcile(merged))
      }
      updateFieldState()
    }
    input.click()
  }

  const removeNode = async (onRemove: () => Promise<number | undefined>) => {
    const result = await onRemove()
    if (result === undefined) return

    const lastKey = props.rootKey?.at(-1)
    if (!(typeof lastKey === 'number')) return

    const parent = getNestedState(fieldState, props.rootKey!.slice(0, -1))
    if (!Array.isArray(parent)) return

    modifyMutable(parent, reconcile(parent.filter((_, idx) => idx !== result)))
  }

  const actions = {
    Export: ({ label }: { label?: string }) => (
      <button
        type="button"
        class="btn btn-sm btn-link"
        onClick={exportCSV}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        title={t('Export data to CSV')}
      >
        <IconDownload size={20} />
        {label}
      </button>
    ),
    Import: ({ label }: { label?: string }) => (
      <button
        type="button"
        class="btn btn-sm btn-link"
        onClick={importCSV}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        title={t('Import data from CSV')}
      >
        <IconUpload size={20} />
        {label}
      </button>
    ),
    Reset: ({ label }: { label?: string }) => (
      <button
        type="button"
        class="btn btn-sm btn-link"
        onClick={reset}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        title={t('Reset all changes')}
      >
        <IconRotate size={20} />
        {label}
      </button>
    ),
    Save: ({ label, onSave }: { label?: string; onSave: (data: InferOutput<TSchema>) => Promise<void> }) => (
      <button
        disabled={!isDirty() || hasError()}
        type="button"
        class="btn btn-primary btn-sm min-w-32"
        onClick={() => save(onSave)}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
      >
        {label ?? t('Save')}
      </button>
    ),
    Remove: ({ onRemove }: { onRemove: () => Promise<number | undefined> }) => (
      <button
        type="button"
        class="btn btn-sm btn-link text-error"
        onClick={() => removeNode(onRemove)}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        title={t('Remove')}
      >
        <IconX size={20} />
      </button>
    ),
  }

  return props.children(status, actions)
}

type Primitive = string | number | boolean | null | undefined

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`

type FlattenSchema<S, Prefix extends string = ''> = S extends { type: 'object'; entries: infer E }
  ? E extends Record<string, unknown>
    ? {
        [K in keyof E & string]: FlattenSchema<E[K], Join<Prefix, K>>
      }[keyof E & string]
    : never
  : Prefix

type FlattenResult<S> = {
  [K in FlattenSchema<S>]: Primitive
}

const flattenBySchema = <TSchema extends GenericSchema>(data: unknown, schema: TSchema): FlattenResult<TSchema>[] => {
  const flattenObject = (obj: unknown, s: GenericSchema, prefix: string, result: Record<string, Primitive>): void => {
    if (
      !s ||
      (s as { type?: string }).type !== 'object' ||
      !(s as { entries?: unknown }).entries ||
      obj == null ||
      typeof obj !== 'object'
    ) {
      return
    }

    const entries = (s as unknown as { entries: Record<string, GenericSchema> }).entries
    const objRecord = obj as Record<string, unknown>

    for (const key in entries) {
      if (!Object.hasOwn(entries, key)) continue

      const valueSchema = entries[key]!
      const value = objRecord[key]
      const path = prefix ? `${prefix}.${key}` : key

      if (value == null) {
        result[path] = value
        continue
      }

      if (valueSchema && valueSchema.type === 'object' && (valueSchema as { entries?: unknown }).entries) {
        flattenObject(value, valueSchema, path, result)
      } else {
        result[path] = typeof value === 'object' ? JSON.stringify(value) : (value as Primitive)
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(data)) {
    const itemSchema = (schema as { item?: GenericSchema }).item

    if (!itemSchema) return []

    return data.map((item) => {
      const result: Record<string, Primitive> = {}
      flattenObject(item, itemSchema, '', result)
      return result as FlattenResult<TSchema>
    })
  }

  const result: Record<string, Primitive> = {}
  flattenObject(data, schema, '', result)
  return [result as FlattenResult<TSchema>]
}

const unwrapSchema = (schema: GenericSchema): GenericSchema => {
  const wrappable = ['nullable', 'nullish', 'optional']
  if (wrappable.includes(schema.type)) {
    return (schema as { wrapped?: GenericSchema }).wrapped ?? schema
  }
  return schema
}

const unflattenBySchema = <TSchema extends GenericSchema>(csvData: unknown, schema: TSchema): InferOutput<TSchema> => {
  const unflattenObject = (flatObj: Record<string, unknown>, s: GenericSchema): Record<string, unknown> => {
    const result: Record<string, unknown> = {}

    if (s.type !== 'object' || !(s as { entries?: unknown }).entries) {
      return result
    }

    const entries = (s as unknown as { entries: Record<string, GenericSchema> }).entries

    for (const [key, rawSchema] of Object.entries(entries)) {
      const valueSchema = unwrapSchema(rawSchema)

      if (valueSchema.type === 'object' && (valueSchema as { entries?: unknown }).entries) {
        const nestedFlat: Record<string, unknown> = {}
        const prefix = `${key}.`

        for (const [flatKey, flatValue] of Object.entries(flatObj)) {
          if (flatKey.startsWith(prefix)) {
            const nestedKey = flatKey.substring(prefix.length)
            nestedFlat[nestedKey] = flatValue
          }
        }

        if (Object.keys(nestedFlat).length > 0) {
          result[key] = unflattenObject(nestedFlat, valueSchema)
        }
        continue
      }

      const value = flatObj[key]

      if (value === undefined || value === null) {
        result[key] = value
        continue
      }

      if (valueSchema.type === 'number') {
        if (typeof value === 'string') {
          const num = Number(value)
          if (Number.isNaN(num)) {
            result[key] = value
          } else {
            result[key] = num
          }
        } else {
          result[key] = value
        }
      } else if (valueSchema.type === 'boolean') {
        if (typeof value === 'boolean') {
          result[key] = value
        } else if (typeof value === 'string') {
          const lower = value.toLowerCase()
          result[key] = lower === 'true' || lower === '1' || lower === 'yes'
        } else {
          result[key] = Boolean(value)
        }
      } else if (
        (valueSchema.type === 'array' || valueSchema.type === 'record') &&
        typeof value === 'string' &&
        (value.startsWith('{') || value.startsWith('['))
      ) {
        try {
          result[key] = JSON.parse(value)
        } catch (_) {
          result[key] = value
        }
      } else {
        result[key] = value
      }
    }

    return result
  }

  if (schema.type === 'array' && Array.isArray(csvData)) {
    const itemSchema = (schema as { item?: GenericSchema }).item

    if (!itemSchema) {
      return []
    }

    return csvData.map((row) => unflattenObject(row, itemSchema))
  }

  if (Array.isArray(csvData) && csvData.length > 0) {
    return unflattenObject(csvData[0], schema)
  }

  return unflattenObject(csvData as Record<string, unknown>, schema)
}

const smartMerge = <T,>(base: T, incoming: Partial<T>, schema: GenericSchema): T => {
  const merge = (b: unknown, i: unknown, s: GenericSchema): unknown => {
    if (s.type === 'array') return i

    if (s.type === 'object' && (s as { entries?: unknown }).entries) {
      const result = { ...(b as Record<string, unknown>) }
      const entries = (s as unknown as { entries: Record<string, GenericSchema> }).entries

      for (const [key, valueSchema] of Object.entries(entries)) {
        if (key in (i as Record<string, unknown>)) {
          result[key] = merge((b as Record<string, unknown>)?.[key], (i as Record<string, unknown>)[key], valueSchema)
        }
      }
      return result
    }
    return i
  }
  return merge(base, incoming, schema) as T
}

type FieldStateLeaf = { dirty: boolean; error: string }

interface FieldStateTree {
  [key: string]: FieldStateLeaf | FieldStateTree
}

const buildFieldState = (
  source: unknown,
  staging: unknown,
  schema: GenericSchema,
  excludeKeys?: Paths<ContentType>[],
  rootKey?: Paths<ContentType> | [],
): FieldStateTree => {
  const sourceValue = rootKey && rootKey.length > 0 ? getNestedValue(source as ContentType, rootKey) : source
  const stagingValue = rootKey && rootKey.length > 0 ? getNestedValue(staging as ContentType, rootKey) : staging
  const excludeSet = new Set(excludeKeys?.map((path) => path.join('.')) ?? [])

  const walk = (
    curSource: unknown,
    curStaging: unknown,
    curSchema: GenericSchema,
    path: (string | number)[],
  ): FieldStateTree | FieldStateLeaf => {
    const pathStr = path.join('.')
    if (excludeSet.has(pathStr)) return {}

    if (curSchema.type === 'object' && 'entries' in curSchema && curStaging && typeof curStaging === 'object') {
      const entries = curSchema.entries as Record<string, GenericSchema>
      const result: Record<string, FieldStateTree | FieldStateLeaf> = {}
      for (const key of Object.keys(entries)) {
        const childSchema = entries[key]
        if (!childSchema) continue
        const childSource = (curSource as Record<string, unknown> | undefined)?.[key]
        const childStaging = (curStaging as Record<string, unknown> | undefined)?.[key]
        result[key] = walk(childSource, childStaging, childSchema, [...path, key])
      }
      return result
    }

    // fix record field
    if (curSchema.type === 'record' && curStaging && typeof curStaging === 'object') {
      const valueSchema = (curSchema as { value?: GenericSchema }).value
      if (!valueSchema) return {} as FieldStateTree
      const result: Record<string, FieldStateTree | FieldStateLeaf> = {}
      for (const key of Object.keys(curStaging as object)) {
        const childSource = (curSource as Record<string, unknown> | undefined)?.[key]
        const childStaging = (curStaging as Record<string, unknown>)[key]
        result[key] = walk(childSource, childStaging, valueSchema, [...path, key])
      }
      return result
    }

    if (curSchema.type === 'array' && Array.isArray(curStaging) && 'item' in curSchema) {
      const itemSchema = (curSchema as { item?: GenericSchema }).item
      if (!itemSchema) return [] as unknown as FieldStateTree

      return curStaging.map((item, idx) =>
        walk(Array.isArray(curSource) ? curSource[idx] : undefined, item, itemSchema, [...path, idx]),
      ) as unknown as FieldStateTree
    }

    const parseResult = v.safeParse(curSchema, curStaging)
    return {
      dirty: curStaging !== curSource,
      error: parseResult.success ? '' : parseResult.issues[0]?.message,
    }
  }

  return walk(sourceValue, stagingValue, schema, rootKey ?? []) as FieldStateTree
}
