import { IconExternalLink } from '@tabler/icons-solidjs'
import type { NavigateOptions } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { previewV1CreatePreviewSession } from '@/api'
import { router } from '@/router'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  link: NavigateOptions
  title?: string
  modified?: string
  class?: string
}

export const PreviewButton = (props: Props) => {
  const { t } = useTranslation()

  const openPreview = async () => {
    const { data } = await previewV1CreatePreviewSession()
    const origin = window.location.origin.replace(/^(https?:\/\/)[^.]+/, '$1preview')
    const path = router.buildLocation(props.link).href
    window.open(`${origin}/preview/${data}?next=${encodeURIComponent(path)}`, '_blank')
  }

  return (
    <button
      type="button"
      class={`btn btn-primary btn-sm btn-link no-underline mr-auto ${props.class ?? ''}`}
      onMouseDown={openPreview}
      tabIndex={-1}
    >
      <IconExternalLink size={20} />
      {props.title ?? t('Preview')}
      <Show when={props.modified}>
        <span class="text-base-content/40">{new Date(props.modified!).toLocaleString()}</span>
      </Show>
    </button>
  )
}
