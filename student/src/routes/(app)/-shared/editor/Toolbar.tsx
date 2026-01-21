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
  activeState: () => Record<string, boolean>
  updateActiveState: () => void
  uploadDisabled: () => boolean
  insertFile: () => void
}

export const Toolbar = (props: Props) => {
  const { t } = useTranslation()
  const [showHeadingDropdown, setShowHeadingDropdown] = createSignal(false)
  const [showAlignDropdown, setShowAlignDropdown] = createSignal(false)

  const getCurrentHeadingIcon = () => {
    const activeState = props.activeState()
    if (activeState.h1) return IconH1
    if (activeState.h2) return IconH2
    if (activeState.h3) return IconH3
    return IconH1
  }

  const getCurrentAlignIcon = () => {
    const activeState = props.activeState()
    if (activeState.alignCenter) return IconAlignCenter
    if (activeState.alignRight) return IconAlignRight
    if (activeState.alignJustify) return IconAlignJustified
    return IconAlignLeft
  }

  const formatButtons: ToolbarButton[] = [
    {
      icon: IconBold,
      title: t('Bold'),
      onClick: () => props.editor()?.chain().focus().toggleBold().run(),
      isActive: () => props.activeState().bold,
    },
    {
      icon: IconHighlight,
      title: t('Highlight'),
      onClick: () => props.editor()?.chain().focus().toggleHighlight().run(),
      isActive: () => props.activeState().highlight,
    },
    {
      icon: IconEraser,
      title: t('Clear marks'),
      onClick: () => props.editor()?.chain().focus().unsetAllMarks().run(),
    },
  ]

  const listButtons: ToolbarButton[] = [
    {
      icon: IconList,
      title: t('Bullet'),
      onClick: () => props.editor()?.chain().focus().toggleBulletList().run(),
      isActive: () => props.activeState().bulletList,
    },
    {
      icon: IconListNumbers,
      title: t('Number'),
      onClick: () => props.editor()?.chain().focus().toggleOrderedList().run(),
      isActive: () => props.activeState().orderedList,
    },
    {
      icon: IconListCheck,
      title: t('Task list'),
      onClick: () => props.editor()?.chain().focus().toggleTaskList().run(),
      isActive: () => props.activeState().taskList,
    },
    {
      icon: IconQuote,
      title: t('Blockquote'),
      onClick: () => props.editor()?.chain().focus().toggleBlockquote().run(),
      isActive: () => props.activeState().blockquote,
    },
  ]

  const headingOptions = [
    {
      label: t('Paragraph'),
      onClick: () => {
        props.editor()?.chain().focus().setParagraph().run()
        setShowHeadingDropdown(false)
      },
      isActive: () => {
        const activeState = props.activeState()
        return !activeState.h1 && !activeState.h2 && !activeState.h3
      },
    },
    {
      label: t('Heading 1'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 1 }).run()
        setShowHeadingDropdown(false)
      },
      isActive: () => !!props.activeState().h1,
    },
    {
      label: t('Heading 2'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 2 }).run()
        setShowHeadingDropdown(false)
      },
      isActive: () => !!props.activeState().h2,
    },
    {
      label: t('Heading 3'),
      onClick: () => {
        props.editor()?.chain().focus().toggleHeading({ level: 3 }).run()
        setShowHeadingDropdown(false)
      },
      isActive: () => !!props.activeState().h3,
    },
  ]

  const alignOptions = [
    {
      label: t('Align left'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('left').run()
        setShowAlignDropdown(false)
      },
      isActive: () => !!props.activeState().alignLeft,
    },
    {
      label: t('Align center'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('center').run()
        setShowAlignDropdown(false)
      },
      isActive: () => !!props.activeState().alignCenter,
    },
    {
      label: t('Align right'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('right').run()
        setShowAlignDropdown(false)
      },
      isActive: () => !!props.activeState().alignRight,
    },
    {
      label: t('Align justify'),
      onClick: () => {
        props.editor()?.chain().focus().setTextAlign('justify').run()
        setShowAlignDropdown(false)
      },
      isActive: () => !!props.activeState().alignJustify,
    },
  ]

  return (
    <div class="py-1 px-3 border-b border-base-content/10 flex flex-wrap gap-1.5">
      <ToolbarDropdown
        icon={getCurrentHeadingIcon()}
        title={t('Heading')}
        options={headingOptions}
        show={showHeadingDropdown()}
        setShow={setShowHeadingDropdown}
      />

      <For each={formatButtons}>
        {(button) => <ToolbarButtonComponent button={button} updateActiveState={props.updateActiveState} />}
      </For>

      <ToolbarDropdown
        icon={getCurrentAlignIcon()}
        title={t('Text align')}
        options={alignOptions}
        show={showAlignDropdown()}
        setShow={setShowAlignDropdown}
      />

      <For each={listButtons}>
        {(button) => <ToolbarButtonComponent button={button} updateActiveState={props.updateActiveState} />}
      </For>

      <button
        title={t('Insert file')}
        type="button"
        class="btn btn-sm btn-ghost btn-square"
        onClick={props.insertFile}
        disabled={props.uploadDisabled()}
      >
        <IconUpload size={20} />
      </button>
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

const ToolbarButtonComponent = (props: { button: ToolbarButton; updateActiveState: () => void }) => {
  return (
    <button
      title={props.button.title}
      type="button"
      class={`btn btn-sm btn-ghost btn-square ${props.button.isActive?.() ? 'btn-active' : ''}`}
      onClick={() => {
        props.button.onClick()
        props.updateActiveState()
      }}
      disabled={props.button.disabled?.()}
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
