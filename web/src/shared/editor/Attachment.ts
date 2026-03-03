import { Extension, mergeAttributes } from '@tiptap/core'
import FileHandler from '@tiptap/extension-file-handler'
import Link, { type LinkOptions } from '@tiptap/extension-link'
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { ATTACHMENT_MAX_COUNT, ATTACHMENT_MAX_SIZE } from '@/config'
import i18next from '@/i18n'
import { uniqueFilename } from '@/shared/utils'

interface AttachmentOptions {
  accept: string[]
  maxFileSize: number
  maxFiles: number
  onChange?: (files: File[]) => void
  onValidationError?: (message: string) => void
}

export const Attachment = Extension.create<AttachmentOptions>({
  name: 'attachment',

  addOptions() {
    return {
      accept: [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'text/plain',
        'text/csv',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      maxFileSize: ATTACHMENT_MAX_SIZE,
      maxFiles: ATTACHMENT_MAX_COUNT,
      onChange: undefined,
      onValidationError: undefined,
    }
  },

  addStorage() {
    return {
      fileMap: new Map<string, File>(),
    }
  },

  addExtensions() {
    return [
      FileHandler.configure({
        allowedMimeTypes: this.options.accept,

        onDrop: (editor, files, _pos) => {
          const chain = editor.chain()
          const commands = chain.insertFiles(Array.from(files))
          commands.run()
        },

        onPaste: (editor, files, _htmlContent) => {
          editor.commands.insertFiles(Array.from(files))
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertFilesByInput:
        () =>
        ({ editor }) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.multiple = true
          input.accept =
            this.options.accept
              ?.map((type) => {
                const cleaned = type.trim()
                if (cleaned.includes('/')) return cleaned
                return cleaned.startsWith('.') ? cleaned : `.${cleaned}`
              })
              .join(', ') ?? ''

          input.onchange = (event) => {
            const files = (event.target as HTMLInputElement).files
            if (files && files.length > 0) {
              editor.commands.insertFiles(Array.from(files))
            }
          }

          input.click()
          return true
        },

      insertFiles:
        (files: File[]) =>
        ({ state, commands }) => {
          const currentFileCount = currentFileNames(state).size

          if (files.length + currentFileCount > this.options.maxFiles) {
            this.options.onValidationError?.(
              i18next.t('Maximum {{count}} file allowed', { count: this.options.maxFiles }),
            )
            return false
          }

          const content = []

          for (const file of files) {
            const validationError = validateFile(file, this.options)
            if (validationError) {
              this.options.onValidationError?.(validationError)
              return false
            }

            const filename = uniqueFilename(file.name)
              .replace(/[<>"'&]/g, '')
              .replace(/\s+/g, ' ')
              .trim()

            const renamedFile = new File([file], filename, { type: file.type })
            const blobUrl = URL.createObjectURL(renamedFile)

            this.storage.fileMap.set(filename, renamedFile)

            if (file.type.startsWith('image/')) {
              content.push({ type: 'imageResize', attrs: { src: blobUrl, alt: filename } })
            } else {
              content.push({
                type: 'blockquote',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        marks: [{ type: 'attachmentLink', attrs: { href: blobUrl, download: filename } }],
                        text: filename,
                      },
                      { type: 'hardBreak' },
                      {
                        type: 'text',
                        text: i18next.t('Attachment {{date}}', { date: new Date().toLocaleString() }),
                      },
                    ],
                  },
                ],
              })
            }
          }

          commands.insertContent(content)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('fileTracking'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null

          const currentFilenames = currentFileNames(newState)
          const fileMap: Map<string, File> = this.storage.fileMap

          const files = Array.from(currentFilenames)
            .map((name) => fileMap.get(name))
            .filter((f): f is File => !!f)

          this.options.onChange?.(files)
          return null
        },
      }),

      new Plugin({
        key: new PluginKey('dropHint'),
        view(editorView) {
          const hint = document.createElement('div')
          hint.textContent = i18next.t('Drag and drop files here')
          hint.style.cssText = `
            position: absolute;
            bottom: 4px;
            right: 8px;
            color: #999;
            font-size: 11px;
            pointer-events: none;
            opacity: 0.7;
          `
          const parent = editorView.dom.parentElement?.parentElement
          if (parent) {
            parent.style.position = 'relative'
            parent.appendChild(hint)
          }

          return { destroy: () => hint.remove() }
        },
      }),
    ]
  },
})

const currentFileNames = (newState: EditorState) => {
  const currentFilenames = new Set<string>()

  newState.doc.descendants((node) => {
    if (
      (node.type.name === 'image' || node.type.name === 'imageResize') &&
      node.attrs.src?.startsWith('blob:') &&
      node.attrs.alt
    ) {
      currentFilenames.add(node.attrs.alt)
    }

    node.marks.forEach((mark) => {
      if (mark.type.name === 'attachmentLink' && mark.attrs.href?.startsWith('blob:') && mark.attrs.download) {
        currentFilenames.add(mark.attrs.download)
      }
    })
  })

  return currentFilenames
}

const validateFile = (file: File, options: AttachmentOptions) => {
  if (options.maxFileSize && file.size > options.maxFileSize) {
    return i18next.t('File size must be less than {{size}}MB.', { size: options.maxFileSize / 1024 / 1024 })
  }

  if (options.accept.length === 0) return null
  if (options.accept.includes('*/*')) return null

  const fileExt = file.name.split('.').pop()?.toLowerCase()
  const fileMimeType = file.type

  const isAccepted = options.accept.some((acceptType) => {
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
      return false
    }

    if (fileMimeType && fileMimeType === cleanAcceptType) return true

    return false
  })

  if (!isAccepted) return i18next.t('File type not allowed.')

  return null
}

export const AttachmentLink = Link.extend({
  name: 'attachmentLink',

  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: true,
      HTMLAttributes: {
        class: 'text-primary underline cursor-pointer',
        target: '_blank',
        rel: 'noopener nofollow',
      },
    } as LinkOptions
  },

  parseHTML() {
    return [{ tag: 'a[href]' }]
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      download: {
        default: null,
        parseHTML: (element) => element.getAttribute('download'),
        renderHTML: (attributes) => {
          if (!attributes.download) {
            return {}
          }
          return {
            download: attributes.download,
          }
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('attachmentLinkHandler'),
        props: {
          handleClick(_, __, event) {
            const link = (event.target as HTMLElement)?.closest('a')
            if (!link) return false

            const href = link.getAttribute('href')
            const download = link.getAttribute('download')

            if (download && href) {
              event.preventDefault()

              if (href.startsWith('blob:')) {
                const a = document.createElement('a')
                a.href = href
                a.download = download
                a.click()
              } else {
                window.open(href, '_blank')
              }

              return true
            }

            return false
          },
        },
      }),
    ]
  },
})
