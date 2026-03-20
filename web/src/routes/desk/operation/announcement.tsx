import { createFileRoute } from '@tanstack/solid-router'
import { type DeskAnnouncementSpec, deskV1GetAnnouncements } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/operation/announcement')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskAnnouncementSpec> => ({
  title: t('Partner'),
  cacheKey: 'deskV1GetAnnouncements',
  searchable: true,
  fetcher: deskV1GetAnnouncements,
  columns: [
    { key: 'writer', label: t('Writer'), render: (writer) => <Avatar user={writer} size="sm" rounded /> },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'title', label: t('Title'), render: (title) => <span class="line-clamp-1">{title}</span> },
    { key: 'public', label: t('Public'), type: 'boolean' },
    { key: 'pinned', label: t('Pinned'), type: 'boolean' },
    { key: 'read', label: t('Read') },
  ],
  detail: [
    { key: 'writer', label: t('Writer'), render: (writer) => writer.name },
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'title', label: t('Title') },
    { key: 'body', label: t('Body'), type: 'content' },
  ],
})
