import { IconLink } from '@tabler/icons-solidjs'
import { useLocation, useNavigate } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { marked } from 'marked'
import { createSignal, Show } from 'solid-js'
import type { ChatMessageSchema } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { CopyButton } from '@/shared/CopyButton'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'

interface Props {
  message: ChatMessageSchema
  i?: number
}

export const Message = (props: Props) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [showLink, setShowLink] = createSignal(false)

  const checkPath = () => {
    if (!props.message.path) return
    const currentPath = location().pathname + location().searchStr
    setShowLink(props.message.path !== currentPath)
  }

  return (
    <div class="space-y-8 py-4">
      <Show when={props.message.message}>
        <div class="chat chat-end space-y-1 group">
          <div class="chat-header label flex items-center gap-2">
            <div class="hidden group-hover:inline-block mr-10 relative">
              <CopyButton
                class="absolute inset-0 m-auto z-1"
                onCopy={() => navigator.clipboard.writeText(extractText(props.message.message))}
              />
            </div>
            <Show when={props.i} fallback={<div class="status status-warning" />}>
              {props.i}
            </Show>
            <time class="text-xs" title={props.message.created}>
              {formatDistanceToNow(props.message.created, { addSuffix: true })}
            </time>
          </div>
          <div class="chat-bubble p-4 ml-8 rounded-2xl rounded-br-none!">
            <ContentViewer content={props.message.message} />
          </div>
        </div>
      </Show>

      <Show when={props.message.response}>
        <div class="group">
          <div class="px-4 flex gap-2 items-center cursor-default label" onmouseenter={checkPath}>
            <Avatar user={{ avatar: null, name: '', nickname: t('AI Assistant') }} />
            <div class="text-sm font-semibold">{t('AI Assistant')}</div>
            <Show when={props.message.completed} fallback={<div class="status status-warning" />}>
              <time class="text-xs" title={props.message.completed!}>
                {formatDistanceToNow(props.message.completed!, { addSuffix: true })}
              </time>
            </Show>
            <div class="hidden group-hover:flex text-xs items-center gap-2 ml-4">
              <CopyButton onCopy={() => navigator.clipboard.writeText(extractText(props.message.response))} />
              <Show when={showLink()}>
                <button
                  type="button"
                  class="btn btn-sm btn-circle btn-ghost"
                  title={props.message.path}
                  onclick={() => navigate({ to: props.message.path })}
                >
                  <IconLink size={16} />
                </button>
              </Show>
            </div>
          </div>
          <div class="mx-auto p-4" innerHTML={marked(props.message.response) as string} />
        </div>
      </Show>
    </div>
  )
}
