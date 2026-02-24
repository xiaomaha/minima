import { Editor } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { createEffect, createSignal, onCleanup, onMount, type Setter, Show } from 'solid-js'
import ImageResize from 'tiptap-extension-resize-image'
import type { GenericSchema } from 'valibot'
import * as v from 'valibot'
import { Attachment, AttachmentLink } from '@/shared/editor/Attachment'
import { SafeUndo } from '@/shared/editor/SafeUndo'
import { Toolbar } from '@/shared/editor/Toolbar'
import { showToast } from '@/shared/toast/store'
import { type ContentType, type State, useEditing } from '../-context/editing'
import { getNestedState, getNestedValue, type Paths, setNestedState, setNestedValue } from './helper'

const DIRTY_FIELD_STYLE = 'bg-amber-100! in-data-[theme=dark]:bg-amber-900!'

interface Props {
  path: Paths<ContentType>
  label: string
  schema: GenericSchema
  class?: string
  setFiles?: Setter<File[]>
}

export default (props: Props) => {
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
          <div ref={editorWrapperEl} class="flex-1 overflow-y-auto inset-shadow-xs" />
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

  return Promise.all(
    entries.map(({ url, name }) =>
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => new File([blob], name, { type: blob.type })),
    ),
  )
}
