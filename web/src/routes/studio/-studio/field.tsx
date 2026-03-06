import { IconDownload, IconX } from '@tabler/icons-solidjs'
import { Editor } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  type Setter,
  Show,
  Switch,
  untrack,
} from 'solid-js'
import ImageResize from 'tiptap-extension-resize-image'
import type { GenericSchema } from 'valibot'
import * as v from 'valibot'
import { ATTACHMENT_MAX_SIZE } from '@/config'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { Attachment, AttachmentLink } from '@/shared/editor/Attachment'
import { SafeUndo } from '@/shared/editor/SafeUndo'
import { Toolbar } from '@/shared/editor/Toolbar'
import { ImageCropDialog } from '@/shared/image/ImageCropDialog'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
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

interface Props extends FieldProps {
  setFiles?: Setter<File[]>
}

export const RichTextField = (props: Props) => {
  const normalizeHtml = (html: string) => {
    return html
      .replace(/<li><p>(.*?)<\/p><\/li>/g, '<li>$1</li>')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/\s+<\//g, '</')
      .replace(/^<p>|<\/p>$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/(<\/p><p>)\s+/g, '$1')
      .trim()
  }

  let editorWrapperEl: HTMLDivElement | undefined
  let editor: Editor | undefined
  let currentHtml: string = ''

  const { source, staging, fieldState } = useEditing()

  const value = () => (getNestedValue(staging, props.path) as string | undefined) || ''
  const state = () => getNestedState(fieldState, props.path) as State | undefined

  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const [draft, setDraft] = createSignal(value())

  const [editorInstance, setEditorInstance] = createSignal<Editor | undefined>()

  onMount(() => {
    if (!editorWrapperEl) return

    requestAnimationFrame(() => {
      editor = new Editor({
        element: editorWrapperEl,
        extensions: [
          SafeUndo,
          StarterKit.configure({ link: false }),
          Placeholder.configure({ placeholder: props.label }),
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
          Highlight.configure({ multicolor: false }),
          TaskList,
          TaskItem.configure({ nested: true }),
          ...(props.setFiles
            ? [
                ImageResize,
                AttachmentLink,
                Attachment.configure({
                  onChange: (files) => props.setFiles?.(files),
                  onValidationError: (message) => {
                    showToast({ title: message, message, type: 'error', duration: 3000 })
                  },
                }),
              ]
            : []),
        ],
        content: draft(),
        editorProps: {
          attributes: {
            class: 'prose max-w-none break-all h-full text-sm px-3 py-2 outline-0 border-0 w-full min-h-20',
          },
        },
        onUpdate: () => {
          if (!editor) return
          currentHtml = editor.isEmpty ? '' : editor.getHTML()
          setDraft(currentHtml)
          setNestedValue(staging, props.path, currentHtml)
        },
      })
      setEditorInstance(editor)
    })
  })

  createEffect(() => {
    const editor = editorInstance()
    if (!editor) return
    const currentValue = value()

    if (currentValue === currentHtml) return
    editor.commands.setContent(currentValue ?? '')
    editor.view.updateState(
      EditorState.create({
        schema: editor.state.schema,
        plugins: editor.state.plugins,
        doc: editor.state.doc,
      }),
    )

    if (!props.setFiles) return
    if (currentValue === getNestedValue(source, props.path)) return

    // restore files between route changes
    const entries: { url: string; name: string }[] = []
    editor.state.doc.descendants((node) => {
      if (
        (node.type.name === 'image' || node.type.name === 'imageResize') &&
        node.attrs.src?.startsWith('blob:') &&
        node.attrs.alt
      ) {
        entries.push({ url: node.attrs.src, name: node.attrs.alt })
      }
      node.marks.forEach((mark) => {
        if (mark.type.name === 'attachmentLink' && mark.attrs.href?.startsWith('blob:') && mark.attrs.download) {
          entries.push({ url: mark.attrs.href, name: mark.attrs.download })
        }
      })
      return true
    })

    Promise.all(
      entries.map(({ url, name }) =>
        fetch(url)
          .then((r) => r.blob())
          .then((blob) => new File([blob], name, { type: blob.type })),
      ),
    ).then((files) => {
      if (files.length > 0) props.setFiles?.(files)
    })
  })

  createEffect(() => {
    const val = draft()
    const result = v.safeParse(props.schema, val.replace(/<[^>]*>/g, '').trim())
    setNestedState(fieldState, props.path, {
      dirty: normalizeHtml(val) !== normalizeHtml((getNestedValue(source, props.path) as string | undefined) || ''),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  onCleanup(() => {
    editor?.destroy()
  })

  return (
    <div class="[&_button]:opacity-40 hover:[&_button]:opacity-100">
      <div class="floating-label rounded" classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}>
        <span class="bg-transparent -top-0.5">{props.label}</span>
        <input name={props.label} placeholder={props.label} value={value()} hidden />
        <div
          class="flex flex-col min-h-0 w-full placeholder:text-base-content/40"
          classList={{ 'hover:bg-base-200 has-focus-within:bg-base-200': !isDirty() }}
        >
          <Toolbar editor={() => editor} class="bg-base-100" enableAttachment={!!props.setFiles} />
          <div ref={editorWrapperEl} class="max-h-100 flex-1 overflow-y-auto inset-shadow-xs" />
        </div>
      </div>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </div>
  )
}

export const collectBlobFiles = async (html: string): Promise<File[]> => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const entries: { url: string; name: string }[] = []

  // image / imageResize: <img src="blob:..." alt="filename">
  doc.querySelectorAll('img[src^="blob:"]').forEach((el) => {
    const src = el.getAttribute('src')!
    const name = el.getAttribute('alt') || 'image'
    entries.push({ url: src, name })
  })

  // attachmentLink: <a href="blob:..." download="filename">
  doc.querySelectorAll('a[href^="blob:"][download]').forEach((el) => {
    const href = el.getAttribute('href')!
    const name = el.getAttribute('download') || 'file'
    entries.push({ url: href, name })
  })

  const results = await Promise.allSettled(
    entries.map(({ url, name }) =>
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => new File([blob], name, { type: blob.type })),
    ),
  )

  return results.filter((r): r is PromiseFulfilledResult<File> => r.status === 'fulfilled').map((r) => r.value)
}

interface AutocompleteOption<T extends number | string> {
  id: T
  label: string
}

interface AutocompleteFieldProps<T extends number | string> {
  path: Paths<ContentType>
  label: string
  schema: GenericSchema
  suggestions: AutocompleteOption<T>[]
  multiple?: boolean
  class?: string
  badgeClass?: string
  readonly?: boolean
  onFocus?: () => void
}

export const AutocompleteField = <T extends number | string>(props: AutocompleteFieldProps<T>) => {
  const { source, staging, fieldState } = useEditing()

  const value = () => {
    const val = getNestedValue(staging, props.path)
    if (props.multiple) return (val as T[] | undefined) ?? []
    return val as T | undefined
  }

  const selectedItems = () => {
    if (props.multiple) {
      return (value() as T[])
        .map((id) => props.suggestions.find((s) => s.id === id))
        .filter(Boolean) as AutocompleteOption<T>[]
    }
    const id = value() as T | undefined
    if (id == null) return []
    const found = props.suggestions.find((s) => s.id === id)
    return found ? [found] : []
  }

  const state = () => getNestedState(fieldState, props.path) as State | undefined
  const isDirty = () => state()?.dirty ?? false
  const hasError = () => state()?.error ?? ''

  const checkDirty = () => {
    const sourceVal = getNestedValue(source, props.path)
    const stagingVal = getNestedValue(staging, props.path)
    if (props.multiple) {
      const src = (sourceVal as T[] | undefined) ?? []
      const stg = (stagingVal as T[] | undefined) ?? []
      if (src.length !== stg.length) return true
      for (let i = 0; i < stg.length; i++) {
        if (stg[i] !== src[i]) return true
      }
      return false
    }
    return stagingVal !== sourceVal
  }

  createEffect(() => {
    const val = props.multiple ? (value() as T[]).join(', ') : value()
    const result = v.safeParse(props.schema, val)
    setNestedState(fieldState, props.path, {
      dirty: checkDirty(),
      error: result.success ? '' : result.issues[0].message,
    })
  })

  const labelToId = createMemo(
    () => Object.fromEntries(props.suggestions.map((s) => [s.label, s.id])) as Record<string, T>,
  )

  const suggestionLabels = createMemo(() => {
    if (props.multiple) {
      const current = value() as T[]
      return props.suggestions.filter((s) => !current.includes(s.id)).map((s) => s.label)
    }
    return props.suggestions.map((s) => s.label)
  })

  const addItem = (label: string) => {
    const id = labelToId()[label]
    if (id == null) return
    if (props.multiple) {
      const current = value() as T[]
      if (current.includes(id)) return
      setNestedValue(staging, props.path, [...current, id] as never)
    } else {
      setNestedValue(staging, props.path, id as never)
    }
  }

  const removeItem = (id: T) => {
    if (props.multiple) {
      setNestedValue(staging, props.path, (value() as T[]).filter((v) => v !== id) as never)
    } else {
      setNestedValue(staging, props.path, getNestedValue(source, props.path) as never)
    }
  }

  return (
    <div class="flex-1" onclick={(e) => e.preventDefault()}>
      <div
        class={
          'py-2 px-3 flex flex-wrap gap-2 items-center h-auto min-h-10 cursor-text rounded focus-within:bg-base-200 ' +
          `${STUDIO_FIELD_STYLE} ${props.class ?? ''}`
        }
        classList={{ [DIRTY_FIELD_STYLE]: isDirty() }}
      >
        <For each={selectedItems()}>
          {(item) => (
            <span class={`badge badge-soft gap-1 max-w-full ${props.badgeClass ?? ''}`}>
              <span class="line-clamp-1 truncate">{item.label}</span>
              <Show when={!props.readonly}>
                <button
                  type="button"
                  class="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    removeItem(item.id)
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  tabIndex={-1}
                >
                  <IconX size={12} />
                </button>
              </Show>
            </span>
          )}
        </For>
        <AutocompleteInput
          suggestions={suggestionLabels()}
          placeholder={props.label}
          onCommit={addItem}
          onFocus={props.onFocus}
          clearInputOnCommit
          selectFirstOnCommit
          class="flex-1 min-w-40 border-0 shadow-none -my-2"
          inputClass="outline-0 border-none shadow-none bg-transparent"
          dropdownClass="bg-base-100 z-10"
          autofocus={false}
        />
      </div>
      <Show when={hasError()}>
        <div class="bg-transparent text-xs ml-3 mt-0.5 text-base-content/40 flex items-center gap-2">
          <div class="status status-error" />
          {hasError()}
        </div>
      </Show>
    </div>
  )
}

interface DataBindFieldProps<T extends number | string, P = void> {
  path: Paths<ContentType>
  label: string
  schema: GenericSchema
  fetchParams: () => P
  fetchFn: (params: P) => Promise<AutocompleteOption<T>[] | undefined>
  cacheKey: string
  multiple?: boolean
  class?: string
  badgeClass?: string
  readonly?: boolean
}

export const DataBindField = <T extends number | string, P = void>(props: DataBindFieldProps<T, P>) => {
  const [store] = createCachedStore(
    props.cacheKey,
    () => props.fetchParams() ?? ({} as P),
    async (params) => props.fetchFn(params),
  )

  return (
    <AutocompleteField
      path={props.path}
      label={props.label}
      schema={props.schema}
      suggestions={store.data ?? []}
      multiple={props.multiple}
      class={props.class}
      badgeClass={props.badgeClass}
      readonly={props.readonly}
    />
  )
}
