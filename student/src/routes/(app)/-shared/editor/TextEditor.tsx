import { IconDragDrop2 } from '@tabler/icons-solidjs'
import { Editor } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import type { JSX, Setter } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import ImageResize from 'tiptap-extension-resize-image'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { uniqueFilename } from '@/shared/utils'
import { Attachment } from './Attachment'
import { Toolbar } from './Toolbar'

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

interface Props {
  value: string
  onInput?: JSX.EventHandler<FieldElement, InputEvent>
  onBlur?: JSX.EventHandler<FieldElement, FocusEvent>
  onChange?: JSX.EventHandler<FieldElement, Event>
  placeholder?: string
  name?: string
  ref?: (el: FieldElement) => void
  autofocus?: boolean
  accept?: string[]
  setFiles?: Setter<File[]>
  maxFiles?: number
  maxFileSize?: number
  class?: string
  hideToolbar?: boolean
  customEvents?: Record<string, (event: CustomEvent, editor: Editor) => void>
}

export const TextEditor = (props: Props) => {
  const { t } = useTranslation()

  let containerRef: HTMLDivElement | undefined
  let editorWrapperRef: HTMLDivElement | undefined
  let editor: Editor | undefined
  let fileInputRef: HTMLInputElement | undefined
  const [activeState, setActiveState] = createSignal<Record<string, boolean>>({})
  const [uploadDisabled, setUploadDisabled] = createSignal(false)
  const [fileMap, setFileMap] = createSignal<Map<string, File>>(new Map())
  const [currentHtml, setCurrentHtml] = createSignal(props.value)
  const [isDragging, setIsDragging] = createSignal(false)
  const [dropMessage, setDropMessage] = createSignal('')
  const [isError, setIsError] = createSignal(false)

  const handleRef = (el: HTMLDivElement) => {
    containerRef = el
  }

  const handleEditorWrapperRef = (el: HTMLDivElement) => {
    editorWrapperRef = el
  }

  const handleFileInputRef = (el: HTMLInputElement) => {
    fileInputRef = el
  }

  const getFileCount = (html: string) => {
    const imgCount = (html.match(/alt="[^"]+"/g) || []).length
    const fileCount = (html.match(/download="[^"]+"/g) || []).length
    return imgCount + fileCount
  }

  const validateFile = (file: File): string | null => {
    if (props.maxFileSize && file.size > props.maxFileSize) {
      return t('File size must be less than {{size}}MB', { size: props.maxFileSize / 1024 / 1024 })
    }

    if (!props.accept || props.accept.length === 0) return null

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    const fileMimeType = file.type

    const isAccepted = props.accept.some((acceptType) => {
      const cleanAcceptType = acceptType.trim().toLowerCase()

      if (cleanAcceptType.startsWith('.')) {
        const ext = cleanAcceptType.substring(1)
        return fileExt === ext
      }

      if (!cleanAcceptType.includes('/')) {
        return fileExt === cleanAcceptType
      }

      if (cleanAcceptType.endsWith('/*')) {
        const prefix = cleanAcceptType.slice(0, -2)
        if (fileMimeType.startsWith(`${prefix}/`)) return true

        if (prefix === 'image' && fileExt) {
          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(fileExt)
        }
        if (prefix === 'video' && fileExt) {
          return ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(fileExt)
        }
        if (prefix === 'audio' && fileExt) {
          return ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileExt)
        }
        return false
      }

      if (fileMimeType && fileMimeType === cleanAcceptType) return true

      const mimeToExt: Record<string, string[]> = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/gif': ['gif'],
        'image/webp': ['webp'],
        'image/svg+xml': ['svg'],
        'application/pdf': ['pdf'],
        'application/msword': ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'application/vnd.ms-excel': ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
        'text/plain': ['txt'],
        'text/csv': ['csv'],
      }

      const extensions = mimeToExt[cleanAcceptType]
      if (extensions && fileExt && extensions.includes(fileExt)) return true

      return false
    })

    if (!isAccepted) return t('File type not allowed.')

    return null
  }

  const dragFileMessage =
    `${t('Drag and drop files here')}. ` +
    `${props.accept?.length ? t('{{types}} allowed.', { types: props.accept.join(', ') }) : ''}`

  const restoreDropMessage = () => {
    if (!uploadDisabled()) {
      const totalCount = getFileCount(currentHtml())
      const remaining = props.maxFiles ? props.maxFiles - totalCount : 0

      if (remaining > 0) {
        setDropMessage(dragFileMessage)
      }
    }
  }

  const insertFileToEditor = (file: File) => {
    if (!editor) return

    const filename = uniqueFilename(file.name)
      .replace(/[<>"'&]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const renamedFile = new File([file], filename, { type: file.type })
    const blobUrl = URL.createObjectURL(renamedFile)

    if (file.type.startsWith('image/')) {
      editor.chain().focus().setImage({ src: blobUrl, alt: filename }).run()
      setTimeout(() => {
        const imgElement = editor?.view.dom.querySelector(`img[alt="${CSS.escape(filename)}"]`)
        if (imgElement) {
          ;(imgElement as HTMLImageElement).click()
        }
      }, 0)
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'attachment',
          attrs: {
            href: blobUrl,
            download: filename,
            size: file.size,
          },
        })
        .run()
    }

    const newMap = new Map(fileMap())
    newMap.set(filename, renamedFile)
    setFileMap(newMap)
    props.setFiles?.(Array.from(newMap.values()))
  }

  const processFile = (file: File) => {
    if (!editor) return

    const validationError = validateFile(file)
    if (validationError) {
      setDropMessage(validationError)
      setIsError(true)
      setTimeout(() => {
        setIsError(false)
        restoreDropMessage()
      }, 2000)
      return
    }

    insertFileToEditor(file)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploadDisabled()) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === editorWrapperRef) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (uploadDisabled()) return

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length === 0) return

    const currentFileCount = getFileCount(currentHtml())

    if (props.maxFiles && currentFileCount + files.length > props.maxFiles) {
      setDropMessage(t('Maximum {{count}} file allowed', { count: props.maxFiles }))
      setIsError(true)
      setTimeout(() => {
        setIsError(false)
        restoreDropMessage()
      }, 2000)
      return
    }

    files.forEach((file) => {
      processFile(file)
    })
  }

  onMount(() => {
    if (!containerRef) return

    editor = new Editor({
      element: containerRef,
      extensions: [
        StarterKit.configure({
          link: false,
        }),
        Placeholder.configure({
          placeholder: props.placeholder ?? '',
        }),
        ImageResize,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        }),
        Attachment,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Highlight.configure({
          multicolor: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
      ],
      content: props.value ?? '',
      editorProps: {
        attributes: {
          class: 'outline-0 p-3 h-full break-all',
        },
      },

      onUpdate: ({ editor: tiptapEditor }) => {
        const html = tiptapEditor.isEmpty ? '' : tiptapEditor.getHTML()

        updateActiveState()
        setCurrentHtml(html)
        checkRemovedFiles(html)

        if (props.onInput) {
          const event = {
            currentTarget: { value: html },
            target: { value: html },
          }
          props.onInput(event as unknown as InputEvent & { currentTarget: FieldElement; target: Element })
        }
      },

      onBlur: () => {
        if (props.onBlur) {
          const event = {
            currentTarget: containerRef,
            target: containerRef,
          }
          props.onBlur(event as unknown as FocusEvent & { currentTarget: FieldElement; target: Element })
        }
      },

      onSelectionUpdate: () => {
        updateActiveState()
      },
    })

    if (props.ref && containerRef) {
      props.ref(containerRef as unknown as FieldElement)
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

    if (editorWrapperRef) {
      const dragHandlers = {
        dragover: handleDragOver,
        dragleave: handleDragLeave,
        drop: handleDrop,
      }

      Object.entries(dragHandlers).forEach(([event, handler]) => {
        editorWrapperRef!.addEventListener(event, handler as EventListener)
      })

      onCleanup(() => {
        Object.entries(dragHandlers).forEach(([event, handler]) => {
          editorWrapperRef!.removeEventListener(event, handler as EventListener)
        })
      })
    }
  })

  createEffect(() => {
    const value = props.value
    untrack(() => {
      if (editor && value !== currentHtml()) {
        editor.commands.setContent(props.value ?? '', { emitUpdate: false })
        setCurrentHtml(props.value ?? '')
        setFileMap(new Map())
        props.setFiles?.([])
      }
    })
  })

  createEffect(() => {
    if (!uploadDisabled() && !isDragging()) {
      const totalCount = getFileCount(currentHtml())
      const remaining = props.maxFiles ? props.maxFiles - totalCount : 0

      if (remaining > 0) {
        setDropMessage(dragFileMessage)
      } else {
        setDropMessage('')
      }
    }
  })

  const updateActiveState = () => {
    if (!editor) return

    setActiveState({
      bold: editor.isActive('bold'),
      highlight: editor.isActive('highlight'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      blockquote: editor.isActive('blockquote'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      alignJustify: editor.isActive({ textAlign: 'justify' }),
    })
  }

  const checkRemovedFiles = (html: string) => {
    const keysInEditor = new Set<string>()

    const imgMatches = html.matchAll(/alt="([^"]+)"/g)
    for (const match of imgMatches) {
      if (match[1]) keysInEditor.add(match[1])
    }

    const fileMatches = html.matchAll(/download="([^"]+)"/g)
    for (const match of fileMatches) {
      if (match[1]) keysInEditor.add(match[1])
    }

    const currentMap = fileMap()
    const removedKeys = Array.from(currentMap.keys()).filter((key) => !keysInEditor.has(key))

    if (removedKeys.length > 0) {
      const newMap = new Map(currentMap)
      removedKeys.forEach((key) => {
        const file = currentMap.get(key)
        if (file) {
          URL.revokeObjectURL(URL.createObjectURL(file))
        }
        newMap.delete(key)
      })
      setFileMap(newMap)
      props.setFiles?.(Array.from(newMap.values()))
    }
  }

  createEffect(() => {
    const totalCount = getFileCount(currentHtml())
    setUploadDisabled(props.maxFiles !== undefined && totalCount >= props.maxFiles)
  })

  onCleanup(() => {
    fileMap().forEach((file) => {
      URL.revokeObjectURL(URL.createObjectURL(file))
    })
    editor?.destroy()
  })

  const insertFile = () => {
    fileInputRef?.click()
  }

  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file || !editor) {
      input.value = ''
      return
    }

    if (props.maxFileSize && file.size > props.maxFileSize) {
      showToast({
        title: t('File size exceeded'),
        message: t('Maximum file size is {{size}}MB', { size: (props.maxFileSize / (1024 * 1024)).toFixed(0) }),
        type: 'error',
        duration: 3000,
      })
      input.value = ''
      return
    }

    insertFileToEditor(file)
    input.value = ''
  }

  const formatAcceptTypes = (accept: string[] | undefined) => {
    return accept
      ?.map((type) => {
        const cleaned = type.trim()
        if (cleaned.includes('/')) return cleaned
        return cleaned.startsWith('.') ? cleaned : `.${cleaned}`
      })
      .join(', ')
  }

  return (
    <div class={`inset-shadow-sm textarea p-0 w-full h-full flex flex-col rounded relative ${props.class}`}>
      <Show when={!props.hideToolbar}>
        <Toolbar
          editor={() => editor}
          activeState={activeState}
          updateActiveState={updateActiveState}
          uploadDisabled={uploadDisabled}
          insertFile={insertFile}
        />
      </Show>
      <input
        ref={handleFileInputRef}
        type="file"
        accept={formatAcceptTypes(props.accept)}
        class="hidden"
        onChange={handleFileChange}
      />
      <div
        ref={handleEditorWrapperRef}
        class="overflow-auto flex-1 mb-4"
        classList={{
          'border-2 border-info rounded-sm': isDragging() && !uploadDisabled(),
          'cursor-not-allowed': isDragging() && uploadDisabled(),
        }}
      >
        <div ref={handleRef} class="h-full" />
        <Show when={!uploadDisabled() && (dropMessage() || isDragging())}>
          <button
            tabindex="-1"
            type="button"
            class="text-xs absolute bottom-1 right-2 rounded-lg cursor-pointer label text-base-content/30"
            classList={{
              'bg-error/10 text-error pointer-events-none': isError(),
            }}
            onClick={() => {
              if (!isError()) {
                insertFile()
              }
            }}
          >
            <IconDragDrop2 size={20} />
            {isDragging() ? t('Drop files here') : dropMessage()}
          </button>
        </Show>
      </div>
    </div>
  )
}
