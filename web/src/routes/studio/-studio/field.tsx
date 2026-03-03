import { IconDownload, IconX } from '@tabler/icons-solidjs'
import { createEffect, createSignal, For, lazy, Match, onMount, Show, Switch, untrack } from 'solid-js'
import type { GenericSchema } from 'valibot'
import * as v from 'valibot'
import { ATTACHMENT_MAX_SIZE } from '@/config'
import { ImageCropDialog } from '@/shared/image/ImageCropDialog'
import { useTranslation } from '@/shared/solid/i18n'
import { filenameFromUrl } from '@/shared/utils'
import type { ContentType, State } from '../-context/editing'
import { useEditing } from '../-context/editing'
import { getNestedState, getNestedValue, type Paths, setNestedState, setNestedValue } from './helper'

const STUDIO_FIELD_STYLE =
  'outline-0 border-0 shadow-none w-full hover:bg-base-200 focus:bg-base-200 focus: placeholder:text-base-content/40'

const DIRTY_FIELD_STYLE = 'bg-amber-100! in-data-[theme=dark]:bg-amber-900!'

interface FieldProps {
  path: Paths<ContentType>
  label: string
  schema: GenericSchema
  class?: string
  readonly?: boolean
}

interface TextFieldProps extends FieldProps {
  multiline?: boolean
}

export const TextField = (props: TextFieldProps) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => (getNestedValue(staging, props.path) as string | undefined) ?? ''
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [draft, setDraft] = createSignal(value())

  createEffect(() => setDraft(value()))

  createEffect(() => {
    const val = draft()
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: val !== (getNestedValue(source, props.path) ?? ''),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  return (
    <label class="floating-label flex-1">
      <span class="bg-transparent">{props.label}</span>
      <Switch>
        <Match when={!props.multiline}>
          <input
            name={props.path.join('.')}
            placeholder={props.label}
            value={draft()}
            onInput={(e) => {
              setDraft(e.currentTarget.value)
              setNestedValue(staging, props.path, e.currentTarget.value)
            }}
            class={`input ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`}
            classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
            readonly={props.readonly}
          />
        </Match>
        <Match when={props.multiline}>
          <textarea
            name={props.path.join('.')}
            placeholder={props.label}
            value={draft()}
            onInput={(e) => {
              setDraft(e.currentTarget.value)
              setNestedValue(staging, props.path, e.currentTarget.value)
            }}
            class={`textarea min-h-14 field-sizing-content ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`}
            classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
            readonly={props.readonly}
          />
        </Match>
      </Switch>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

interface BooleanFieldProps extends FieldProps {}

export const BooleanField = (props: BooleanFieldProps) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => getNestedValue(staging, props.path) as boolean | undefined
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false

  const [draft, setDraft] = createSignal(value())

  createEffect(() => setDraft(value()))

  createEffect(() => {
    const val = draft()
    setNestedState(fieldState, props.path, {
      dirty: val !== getNestedValue(source, props.path),
      error: '',
    })
  })

  return (
    <label
      class={
        'label text-sm p-2.5 rounded text-base-content/40 ' +
        `has-checked:text-base-content has-focus:bg-base-200 ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`
      }
      classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
    >
      <input
        name={props.path.join('.')}
        type="checkbox"
        checked={draft()}
        onInput={(e) => {
          setDraft(e.currentTarget.checked)
          setNestedValue(staging, props.path, e.currentTarget.checked)
        }}
        class="checkbox checkbox-sm outline-0"
        readonly={props.readonly}
      />
      <span>{props.label}</span>
    </label>
  )
}

interface NumberFieldProps extends FieldProps {}

export const NumberField = (props: NumberFieldProps) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => getNestedValue(staging, props.path) as number | undefined
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [draft, setDraft] = createSignal(value())

  createEffect(() => setDraft(value()))

  createEffect(() => {
    const val = draft()
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: val !== getNestedValue(source, props.path),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  return (
    <label class="floating-label">
      <span class="bg-transparent">{props.label}</span>
      <input
        name={props.path.join('.')}
        type="number"
        placeholder={props.label}
        value={(draft() ?? 0) < 0 ? '' : draft()}
        onInput={(e) => {
          const val = e.currentTarget.valueAsNumber
          setDraft((Number.isNaN(val) ? null : val) as number)
          setNestedValue(staging, props.path, Number.isNaN(val) ? null : val)
        }}
        class={`input ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`}
        classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
        readonly={props.readonly}
      />
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

interface SelectFieldProps extends FieldProps {
  options: Record<string, string>
}

export const SelectField = (props: SelectFieldProps) => {
  const { t } = useTranslation()
  const { source, staging, fieldState } = useEditing()

  const value = () => getNestedValue(staging, props.path) as string | undefined
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [draft, setDraft] = createSignal(value())

  createEffect(() => setDraft(value()))

  createEffect(() => {
    const val = draft()
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: val !== getNestedValue(source, props.path),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  return (
    <label class="floating-label flex-1">
      <span class="bg-transparent">{props.label}</span>
      <input name={`$props.path.join('.')}-label`} placeholder={props.label} value={draft() ?? ''} class="hidden" />
      <select
        name={props.path.join('.')}
        value={draft()}
        onChange={(e) => {
          setDraft(e.currentTarget.value)
          setNestedValue(staging, props.path, e.currentTarget.value)
        }}
        class={
          'select [&::picker(select)]:bg-base-100 [&::picker(select)]:mt-0 ' +
          '[&:has(option:disabled:checked)]:text-base-content/40 [&::picker(select)]:text-base-content ' +
          `${STUDIO_FIELD_STYLE} ${props.class ?? ''}`
        }
        classList={{
          [DIRTY_FIELD_STYLE]: isDirty(),
          'pointer-events-none': props.readonly,
        }}
      >
        <option value="" disabled selected>
          {props.label}
        </option>
        <For each={Object.keys(props.options)}>
          {(option) => <option value={option}>{t(props.options[option] ?? '')}</option>}
        </For>
      </select>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

interface CommaSeparatedFieldProps extends FieldProps {}

export const CommaSeparatedField = (props: CommaSeparatedFieldProps) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => (getNestedValue(staging, props.path) as string[] | undefined) || []
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [draft, setDraft] = createSignal(value().join(', '))

  createEffect(() => {
    const val = value()
    const cleanedVal = val.join('')
    const cleanedDraft = untrack(() => draft().replace(/[, ]/g, ''))
    if (cleanedVal === cleanedDraft) return
    setDraft(val.join(', '))
  })

  const checkDirty = () => {
    const sourceArray = getNestedValue(source, props.path) as string[] | undefined
    const stagingArray = getNestedValue(staging, props.path) as string[] | undefined

    if (!stagingArray && !sourceArray) return false
    if (!stagingArray || !sourceArray) return true
    if (stagingArray.length !== sourceArray.length) return true

    for (let i = 0; i < stagingArray.length; i++) {
      if (stagingArray[i] !== sourceArray[i]) return true
    }
    return false
  }

  createEffect(() => {
    const val = draft()
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: checkDirty(),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  return (
    <label class="floating-label flex-1">
      <span class="bg-transparent">{props.label}</span>
      <input
        name={props.path.join('.')}
        placeholder={props.label}
        value={draft()}
        onInput={(e) => {
          setDraft(e.currentTarget.value)
          setNestedValue(
            staging,
            props.path,
            e.currentTarget.value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s),
          )
        }}
        class={`input ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`}
        classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
        readonly={props.readonly}
      />
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

// to restore blob filename between route changes
export const blobFilenameMap = new Map<string, string>()

interface ThumbnailFieldProps {
  path: Paths<ContentType>
  label: string
  class?: string
  required?: boolean
  onFileSelect: (file: File) => void
  readonly?: boolean
}

const THUMBNAIL_MAX_FILE_SIZE = 1024 * 1024

export const ThumbnailField = (props: ThumbnailFieldProps) => {
  const { t } = useTranslation()
  const { source, staging, fieldState } = useEditing()

  const value = () => getNestedValue(staging, props.path) as string | undefined
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [cropFile, setCropFile] = createSignal<File | undefined>()
  const [draft, setDraft] = createSignal(value())

  createEffect(() => setDraft(value()))

  createEffect(() => {
    setNestedState(fieldState, props.path, {
      dirty: value() !== getNestedValue(source, props.path),
      error: !value() && props.required ? t('required') : '',
    })
  })

  onMount(() => {
    const url = value()
    if (!url?.startsWith('blob:')) return
    if (!isDirty()) return
    const filename = blobFilenameMap.get(url) ?? filenameFromUrl(url)
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        props.onFileSelect(new File([blob], filename, { type: blob.type }))
      })
  })

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    ;(e.target as HTMLInputElement).value = ''
    setCropFile(file)
  }

  const handleCrop = (blob: Blob, originalFile: File) => {
    if (blob.size > THUMBNAIL_MAX_FILE_SIZE) {
      setNestedState(fieldState, props.path, {
        dirty: isDirty(),
        error: t('File size exceeds the limit {{size}}MB.', { size: THUMBNAIL_MAX_FILE_SIZE / 1024 / 1024 }),
      })
      setCropFile(undefined)
      return
    } else {
      setNestedState(fieldState, props.path, { dirty: isDirty(), error: '' })
    }

    const croppedFile = new File([blob], originalFile.name, { type: originalFile.type })
    props.onFileSelect(croppedFile)
    const objectUrl = URL.createObjectURL(blob)
    setDraft(objectUrl)
    setNestedValue(staging, props.path, objectUrl)
    setCropFile(undefined)
    blobFilenameMap.set(objectUrl, originalFile.name)
  }

  return (
    <>
      <ImageCropDialog
        file={cropFile()}
        aspectRatio={16 / 9}
        onClose={() => setCropFile(undefined)}
        onCrop={handleCrop}
      />

      <div>
        <label
          class={
            'cursor-pointer py-0.5 px-3 w-60 aspect-video text-base-content/40 rounded border border-dotted border-base-300 ' +
            'relative flex items-center justify-center text-sm hover:bg-base-200'
          }
          classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
        >
          {draft() ? (
            <img src={draft()} alt="thumbnail" class="w-full h-full object-cover aspect-video" />
          ) : (
            <span>
              {props.label}
              <span class="block text-xs text-center">
                {t('Max {{size}}MB', { size: THUMBNAIL_MAX_FILE_SIZE / 1024 / 1024 })}
              </span>
            </span>
          )}
          <input
            name={`${props.path.join('.')}-label`}
            type="file"
            accept="image/*"
            class="hidden"
            onInput={handleFile}
            readonly={props.readonly}
          />
          <Show when={isDirty()}>
            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost text-base-content/40 absolute left-full bottom-0 ml-2"
              onclick={(e) => {
                e.preventDefault()
                setDraft('')
                setNestedValue(staging, props.path, getNestedValue(source, props.path))
              }}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <IconX size={16} />
            </button>
          </Show>
        </label>
        <Show when={hasError()}>
          <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
            <div class="status status-error" />
            {hasError()}
          </div>
        </Show>
      </div>
    </>
  )
}

interface AttachmentFieldProps extends ThumbnailFieldProps {
  allowedTypes?: string[]
  maxSize?: number
}

export const AttachmentField = (props: AttachmentFieldProps) => {
  const { t } = useTranslation()
  const { source, staging, fieldState } = useEditing()

  const maxSize = props.maxSize ?? ATTACHMENT_MAX_SIZE

  const value = () => getNestedValue(staging, props.path) as string | undefined
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  createEffect(() => {
    setNestedState(fieldState, props.path, {
      dirty: value() !== getNestedValue(source, props.path),
      error: !value() && props.required ? t('required') : '',
    })
  })

  onMount(() => {
    const url = value()
    if (!url?.startsWith('blob:')) return
    if (!isDirty()) return
    const filename = blobFilenameMap.get(url) ?? filenameFromUrl(url)
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        props.onFileSelect(new File([blob], filename, { type: blob.type }))
        setFilename(filename)
      })
  })

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    ;(e.target as HTMLInputElement).value = ''

    if (file.size > maxSize) {
      setNestedState(fieldState, props.path, {
        dirty: isDirty(),
        error: t('File size exceeds the limit {{size}}MB.', { size: maxSize / 1024 / 1024 }),
      })
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext && props.allowedTypes && !props.allowedTypes.includes(ext)) {
      setNestedState(fieldState, props.path, {
        dirty: isDirty(),
        error: t('File type is not allowed.'),
      })
      return
    }

    setNestedState(fieldState, props.path, { dirty: isDirty(), error: '' })
    props.onFileSelect(file)
    const objectUrl = URL.createObjectURL(file)
    setNestedValue(staging, props.path, objectUrl)
    setFilename(file.name)
    blobFilenameMap.set(objectUrl, file.name)
  }

  let fileRef: HTMLInputElement | undefined
  const [filename, setFilename] = createSignal('')

  const placeholder = () => `${props.label} ${maxSize / 1024 / 1024}MB ${props.allowedTypes ?? ''}`

  return (
    <label class="floating-label">
      <span class="bg-transparent">{placeholder()}</span>
      <div class="flex items-center gap-2">
        <input
          name={props.path.join('.')}
          placeholder={placeholder()}
          value={filename() || (value() ? filenameFromUrl(value()!) : '')}
          class={`input cursor-pointer ${STUDIO_FIELD_STYLE}`}
          classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
          readonly
          onClick={() => fileRef?.click()}
        />
        <input
          ref={fileRef}
          name={props.path.join('.')}
          type="file"
          accept={props.allowedTypes?.map((t) => `.${t}`).join(',') ?? '*'}
          class="hidden"
          onInput={handleFile}
          readonly={props.readonly}
        />
        <Show when={isDirty()}>
          <button
            type="button"
            class="btn btn-xs btn-circle btn-ghost text-base-content/40"
            onclick={(e) => {
              e.preventDefault()
              setNestedValue(staging, props.path, getNestedValue(source, props.path))
              setFilename('')
            }}
            onMouseDown={(e) => e.preventDefault()}
            tabIndex={-1}
          >
            <IconX size={16} />
          </button>
        </Show>
        <Show when={value()}>
          <a
            href={value()}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-xs btn-circle btn-ghost text-base-content/40"
          >
            <IconDownload size={16} />
          </a>
        </Show>
      </div>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

interface TagFieldProps extends CommaSeparatedFieldProps {
  badgeClass?: string
}

export const TagField = (props: TagFieldProps) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => (getNestedValue(staging, props.path) as string[] | undefined) || []
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [inputDraft, setInputDraft] = createSignal('')

  const checkDirty = () => {
    const sourceArray = getNestedValue(source, props.path) as string[] | undefined
    const stagingArray = getNestedValue(staging, props.path) as string[] | undefined

    if (!stagingArray && !sourceArray) return false
    if (!stagingArray || !sourceArray) return true
    if (stagingArray.length !== sourceArray.length) return true
    for (let i = 0; i < stagingArray.length; i++) {
      if (stagingArray[i] !== sourceArray[i]) return true
    }
    return false
  }

  createEffect(() => {
    const val = value().join(', ')
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: checkDirty(),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || value().includes(trimmed)) return
    setNestedValue(staging, props.path, [...value(), trimmed])
    setInputDraft('')
  }

  const removeTag = (index: number) => {
    setNestedValue(
      staging,
      props.path,
      value().filter((_, i) => i !== index),
    )
  }

  let inputRef: HTMLInputElement | undefined

  return (
    <label class="floating-label flex-1" onclick={(e) => e.preventDefault()}>
      <span class="bg-transparent">{props.label}</span>
      <div
        class={`input flex flex-wrap gap-1 items-center h-auto min-h-10 cursor-text ${STUDIO_FIELD_STYLE} ${props.class ?? ''}`}
        classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
        onclick={() => inputRef?.focus()}
      >
        <For each={value()}>
          {(tag, i) => (
            <span class={`badge gap-1 ${props.badgeClass ?? ''}`}>
              {tag}
              <button
                type="button"
                class="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  removeTag(i())
                }}
                onMouseDown={(e) => e.preventDefault()}
                tabIndex={-1}
              >
                <IconX size={12} />
              </button>
            </span>
          )}
        </For>
        <input
          name={props.path.join('.')}
          ref={inputRef}
          value={inputDraft() || (value().length ? ' ' : '')} // trick to float label
          onInput={(e) => setInputDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag(inputDraft())
            }
            if (e.key === 'Backspace' && !inputDraft() && value().length) {
              removeTag(value().length - 1)
            }
          }}
          onBlur={() => {
            if (inputDraft()) addTag(inputDraft())
          }}
          class="bg-transparent flex-1 min-w-20 h-6 text-sm placeholder:text-base-content/40"
          placeholder={props.label}
          readonly={props.readonly}
        />
      </div>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </label>
  )
}

export const RichTextField = lazy(() => import('./RichtextField'))
