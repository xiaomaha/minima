import { Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  published: string | null
  class?: string
}

export const PublishBadge = (props: Props) => {
  const { t } = useTranslation()

  return (
    <Show
      when={props.published}
      fallback={<div class={`badge badge-xs badge-soft ${props.class ?? ''}`}>{t('Unpublished')}</div>}
    >
      <div class={`badge badge-xs badge-success text-base-100 ${props.class ?? ''}`}>
        {t('Published at {{date}}', { date: new Date(props.published!).toLocaleString() })}
      </div>
    </Show>
  )
}
