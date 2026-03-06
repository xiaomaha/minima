import { IconX } from '@tabler/icons-solidjs'
import { useNavigate, useParams } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { clearCachedInfiniteStoreBy } from '@/shared/solid/cached-infinite-store'
import { clearCachedStoreBy } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID, useEditing } from '../-context/editing'

interface Props {
  class?: string
  deleteFn?: (options: { path: { id: string } }) => Promise<unknown>
}

export const PublishStatus = (props: Props) => {
  const { t } = useTranslation()
  const params = useParams({ from: '/studio/$app/$id' })
  const navigate = useNavigate()

  const { source } = useEditing()

  const deleteContent = async () => {
    if (!props.deleteFn) return
    const { id, app } = params()
    if (!id || !app) return
    if (!confirm(`Are you sure you want to delete this content?`)) return
    await props.deleteFn({ path: { id: params().id } })
    clearCachedStoreBy('studioV1Content')
    clearCachedInfiniteStoreBy('studioV1Content')
    navigate({ to: '/studio/$app/$id', params: { ...params(), id: EMPTY_CONTENT_ID }, replace: true })
  }

  return (
    <Show
      when={!source.published}
      fallback={
        <div class={`badge badge-xs badge-success text-base-100 ${props.class ?? ''}`}>
          {t('Published at {{date}}', { date: new Date(source.published!).toLocaleString() })}
        </div>
      }
    >
      <div class={props.class ?? ''}>
        <div class="badge badge-xs badge-soft font-semibold">{t('Unpublished')}</div>
        <Show when={props.deleteFn && !source.published && params().id !== EMPTY_CONTENT_ID}>
          <div class="badge badge-xs badge-soft btn" onclick={deleteContent}>
            {t('Delete')} <IconX size={12} />
          </div>
        </Show>
      </div>
    </Show>
  )
}
