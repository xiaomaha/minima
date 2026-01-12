import { mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { formatFileSize } from '@/shared/utils'

export const Attachment = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      href: {
        default: null,
      },
      download: {
        default: null,
      },
      size: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-attachment]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false
          const aTag = element.querySelector('a[download]')
          if (!aTag) return false
          return {
            href: aTag.getAttribute('href'),
            download: aTag.getAttribute('download'),
            size: aTag.getAttribute('data-size'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const sizeText = HTMLAttributes.size ? ` (${formatFileSize(Number(HTMLAttributes.size))})` : ''
    return [
      'div',
      mergeAttributes({
        'data-file-attachment': '',
        class: 'my-2',
      }),
      [
        'a',
        {
          href: HTMLAttributes.href,
          download: HTMLAttributes.download,
          'data-size': HTMLAttributes.size,
          class:
            'inline-flex items-center gap-2 px-4 py-3 border border-base-content/20 rounded-lg bg-base-200/50 hover:bg-base-200 transition-colors cursor-pointer',
        },
        (HTMLAttributes.download || 'File') + sizeText,
      ],
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('div')
      container.setAttribute('data-file-attachment', '')
      container.className = 'my-2'

      const a = document.createElement('a')
      a.href = node.attrs.href ?? ''
      a.download = node.attrs.download ?? ''
      a.setAttribute('data-size', node.attrs.size ?? '')
      a.className =
        'inline-flex items-center gap-2 px-4 py-3 border border-base-content/20 rounded-lg bg-base-200/50 hover:bg-base-200 transition-colors cursor-pointer'

      const sizeText = node.attrs.size ? ` (${formatFileSize(Number(node.attrs.size))})` : ''
      a.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5"/>
      </svg>
      <span class="font-medium">${(node.attrs.download || 'File') + sizeText}</span>
    `

      container.appendChild(a)

      return {
        dom: container,
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('handleFileAttachmentClick'),
        props: {
          handleClick(_, __, event) {
            const target = event.target as HTMLElement
            const fileSpan = target.closest('span[data-href][data-download]')
            if (fileSpan) {
              event.preventDefault()
              const href = fileSpan.getAttribute('data-href')
              const download = fileSpan.getAttribute('data-download')
              if (href && download) {
                const a = document.createElement('a')
                a.href = href
                a.download = download
                a.click()
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
