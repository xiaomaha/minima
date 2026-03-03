import { Editor } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { EditorState } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import type { JSX, Setter } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import ImageResize from 'tiptap-extension-resize-image'
import { showToast } from '../toast/store'
import { Attachment, AttachmentLink } from './Attachment'
import { SafeUndo } from './SafeUndo'
import { Toolbar } from './Toolbar'

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

interface Props {
  placeholder?: string
  ref?: (el: HTMLDivElement) => void
  autofocus?: boolean
  class?: string
  hideToolbar?: boolean
  customEvents?: Record<string, (event: CustomEvent, editor: Editor) => void>

  // form
  name?: string
  value: string
  onInput?: JSX.EventHandler<FieldElement, InputEvent>
  onBlur?: JSX.EventHandler<FieldElement, FocusEvent>
  onChange?: JSX.EventHandler<FieldElement, Event>

  // file
  setFiles?: Setter<File[]>
  accept?: string[]
  maxFiles?: number
  maxFileSize?: number
}

export const FormTextEditor = (props: Props) => {
  let editorWrapperEl: HTMLDivElement | undefined
  let editor: Editor | undefined

  const [currentHtml, setCurrentHtml] = createSignal(props.value)

  onMount(() => {
    if (!editorWrapperEl) return

    editor = new Editor({
      element: editorWrapperEl,
      extensions: [
        SafeUndo,
        StarterKit.configure({ link: false }),
        Placeholder.configure({ placeholder: props.placeholder ?? '' }),
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
      content: props.value ?? '',
      editorProps: { attributes: { class: 'prose max-w-none outline-0 break-all h-full px-3 py-2' } },

      onUpdate: ({ editor }) => {
        const html = editor.isEmpty ? '' : editor.getHTML()
        setCurrentHtml(html)

        if (props.onInput) {
          const event = { currentTarget: { value: html }, target: { value: html } }
          props.onInput(event as unknown as InputEvent & { currentTarget: FieldElement; target: Element })
        }
      },

      onBlur: () => {
        if (props.onBlur) {
          const event = { currentTarget: editorWrapperEl, target: editorWrapperEl }
          props.onBlur(event as unknown as FocusEvent & { currentTarget: FieldElement; target: Element })
        }
      },
    })

    if (props.ref && editorWrapperEl) {
      props.ref(editorWrapperEl)
    }

    if (props.customEvents && editor) {
      Object.entries(props.customEvents).forEach(([event, handler]) => {
        window.addEventListener(event, (event) => handler(event as CustomEvent, editor!))
      })

      onCleanup(() => {
        Object.entries(props.customEvents!).forEach(([event, handler]) => {
          window.removeEventListener(event, (event) => handler(event as CustomEvent, editor!))
        })
      })
    }
  })

  createEffect(() => {
    const value = props.value
    untrack(() => {
      if (editor && value !== currentHtml()) {
        editor.commands.setContent(props.value ?? '', { emitUpdate: false })
        editor.view.updateState(
          EditorState.create({
            schema: editor.state.schema,
            plugins: editor.state.plugins,
            doc: editor.state.doc,
          }),
        )

        setCurrentHtml(props.value ?? '')
      }
    })
  })

  onCleanup(() => {
    editor?.destroy()
  })

  return (
    <div class={`textarea p-0 flex flex-col w-full h-full rounded ${props.class ?? ''}`}>
      <Show when={!props.hideToolbar}>
        <Toolbar editor={() => editor} enableAttachment={!!props.setFiles} />
      </Show>
      <div ref={editorWrapperEl} class="flex-1 overflow-y-auto inset-shadow-xs" />
    </div>
  )
}
