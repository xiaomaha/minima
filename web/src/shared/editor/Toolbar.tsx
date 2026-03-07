import {
  IconAlignCenter,
  IconAlignJustified,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconEraser,
  IconH1,
  IconH2,
  IconH3,
  IconHighlight,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconQuote,
  IconUpload,
} from '@tabler/icons-solidjs'
import type { Editor } from '@tiptap/core'
import { type Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  editor: () => Editor | undefined
  enableAttachment?: boolean
  class?: string
}

export const Toolbar = (props: Props) => {
  const { t } = useTranslation()
  const [showHeadingDropdown, setShowHeadingDropdown] = createSignal(false)
  const [showAlignDropdown, setShowAlignDropdown] = createSignal(false)

  const [activeState, setActiveState] = createSignal<Record<string, boolean>>({})

  const updateActiveState = () => {
    const editor = props.editor()
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

  const getCurrentHeadingIcon = () => {
    const active = activeState()
    if (active.h1) return IconH1
    if (active.h2) return IconH2
    if (active.h3) return IconH3
    return IconH1
  }

  const getCurrentAlignIcon = () => {
    const active = activeState()
    if (active.alignCenter) return IconAlignCenter
    if (active.alignRight) return IconAlignRight
    if (active.alignJustify) return IconAlignJustified
    return IconAlignLeft
  }

  const formatButtons: ToolbarButton[] = [
    {
      icon: IconBold,
      title: t('Bold'),
      onClick: () => {
        props.editor()?.chain().focus().toggleBold().run()
        updateActiveState()
      },
      isActive: () => activeState().bold,
    },
    {
      icon: IconHighlight,
      title: t('Highlight'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHighlight().run()
        updateActiveState()
      },
      isActive: () => activeState().highlight,
    },
    {
      icon: IconEraser,
      title: t('Clear marks'),
      onClick: () => {
        props.editor()?.chain().focus().unsetAllMarks().run()
        updateActiveState()
      },
    },
  ]

  const listButtons: ToolbarButton[] = [
    {
      icon: IconList,
      title: t('Bullet'),
      onClick: () => {
        props.editor()?.chain().focus().toggleBulletList().run()
        updateActiveState()
      },
      isActive: () => activeState().bulletList,
    },
    {
      icon: IconListNumbers,
      title: t('Number'),
      onClick: () => {
        props.editor()?.chain().focus().toggleOrderedList().run()
        updateActiveState()
      },
      isActive: () => activeState().orderedList,
    },
    {
      icon: IconListCheck,
      title: t('Task list'),
      onClick: () => {
        props.editor()?.chain().focus().toggleTaskList().run()
        updateActiveState()
      },
      isActive: () => activeState().taskList,
    },
    {
      icon: IconQuote,
      title: t('Blockquote'),
      onClick: () => {
        props.editor()?.chain().focus().toggleBlockquote().run()
        updateActiveState()
      },
      isActive: () => activeState().blockquote,
    },
  ]

  const headingOptions = [
    {
      label: t('Paragraph'),
      onClick: () => {
        props.editor()?.chain().focus().setParagraph().run()
        setShowHeadingDropdown(false)
        updateActiveState()
      },
      isActive: () => {
        const active = activeState()
        return !active.h1 && !active.h2 && !active.h3
      },
    },
    {
      label: t('Heading 1'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 1 }).run()
        setShowHeadingDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().h1,
    },
    {
      label: t('Heading 2'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()
        setShowHeadingDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().h2,
    },
    {
      label: t('Heading 3'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()
        setShowHeadingDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().h3,
    },
  ]

  const alignOptions = [
    {
      label: t('Align left'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('left').run()
        setShowAlignDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().alignLeft,
    },
    {
      label: t('Align center'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('center').run()
        setShowAlignDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().alignCenter,
    },
    {
      label: t('Align right'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('right').run()
        setShowAlignDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().alignRight,
    },
    {
      label: t('Align justify'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('justify').run()
        setShowAlignDropdown(false)
        updateActiveState()
      },
      isActive: () => !!activeState().alignJustify,
    },
  ]

  createEffect(() => {
    const editor = props.editor()
    if (!editor) return

    const handleUpdate = () => {
      updateActiveState()
    }

    editor.on('selectionUpdate', handleUpdate)
    editor.on('transaction', handleUpdate)

    onCleanup(() => {
      editor.off('selectionUpdate', handleUpdate)
      editor.off('transaction', handleUpdate)
    })
  })

  return (
    <div class={`py-1 px-3 flex flex-wrap gap-1.5 ${props.class ?? ''}`}>
      <ToolbarDropdown
        icon={getCurrentHeadingIcon()}
        title={t('Heading')}
        options={headingOptions}
        show={showHeadingDropdown()}
        setShow={setShowHeadingDropdown}
      />

      <For each={formatButtons}>{(button) => <ToolbarButtonComponent button={button} />}</For>

      <ToolbarDropdown
        icon={getCurrentAlignIcon()}
        title={t('Text align')}
        options={alignOptions}
        show={showAlignDropdown()}
        setShow={setShowAlignDropdown}
      />

      <For each={listButtons}>{(button) => <ToolbarButtonComponent button={button} />}</For>

      <Show when={props.enableAttachment}>
        <ToolbarButtonComponent
          button={{
            icon: IconUpload,
            title: t('Insert file'),
            onClick: () => props.editor()?.chain().focus().insertFilesByInput().run(),
          }}
        />
      </Show>
    </div>
  )
}

interface ToolbarButton {
  icon: Component<{ size: number }>
  title: string
  onClick: () => void
  isActive?: () => boolean | undefined
  disabled?: () => boolean
}

interface ToolbarDropdownProps {
  icon: Component<{ size: number }>
  title: string
  options: Array<{
    label: string
    onClick: () => void
    isActive?: () => boolean
  }>
  show: boolean
  setShow: (show: boolean) => void
}

const ToolbarButtonComponent = (props: { button: ToolbarButton }) => {
  return (
    <button
      title={props.button.title}
      type="button"
      class={`btn btn-sm btn-ghost btn-square ${props.button.isActive?.() ? 'btn-active' : ''}`}
      onClick={props.button.onClick}
      disabled={props.button.disabled?.()}
      onMouseDown={(e) => e.preventDefault()}
      tabIndex={-1}
    >
      <props.button.icon size={20} />
    </button>
  )
}

const ToolbarDropdown = (props: ToolbarDropdownProps) => {
  let dropdownRef: HTMLDivElement | undefined

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      props.setShow(false)
    }
  }

  createEffect(() => {
    if (props.show) {
      document.addEventListener('click', handleClickOutside)
    } else {
      document.removeEventListener('click', handleClickOutside)
    }
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  return (
    <div class="relative" ref={dropdownRef}>
      <button
        title={props.title}
        type="button"
        class="btn btn-sm btn-ghost btn-square"
        onClick={(e) => {
          e.stopPropagation()
          props.setShow(!props.show)
        }}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
      >
        <props.icon size={20} />
      </button>
      <Show when={props.show}>
        <div class="absolute top-full left-0 mt-1 bg-base-100 border border-base-content/10 rounded-lg shadow-lg z-10 min-w-37.5">
          <For each={props.options}>
            {(option) => (
              <button
                type="button"
                class={`w-full px-4 py-2 text-left hover:bg-base-200 first:rounded-t-lg last:rounded-b-lg ${
                  option.isActive?.() ? 'bg-base-200 font-semibold' : ''
                }`}
                onClick={() => {
                  option.onClick()
                }}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
