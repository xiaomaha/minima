import { createFileRoute } from '@tanstack/solid-router'
import { type DeskInquiryDetailSpec, type DeskInquirySpec, deskV1GetInquiries, deskV1GetInquiryDetail } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/operation/inquiry')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskInquirySpec, DeskInquiryDetailSpec> => ({
  title: t('Inquiry'),
  cacheKey: 'deskV1GetInquiries',
  searchable: true,
  fetcher: deskV1GetInquiries,
  detailFetcher: (options) => deskV1GetInquiryDetail(options),
  columns: [
    { key: 'writer', label: t('Writer'), render: (writer) => <Avatar user={writer} size="sm" rounded /> },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'title', label: t('Title'), render: (title) => <span class="line-clamp-1">{title}</span> },
    {
      key: 'contentType',
      label: t('Content Type'),
      type: 'badge',
      value: (contentType) => (contentType.model === 'user' ? '' : contentType.model),
    },
    { key: 'solved', label: t('Solved'), type: 'boolean' },
  ],
  detail: [
    { key: 'writer', label: t('Writer'), render: (writer) => writer.name },
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'title', label: t('Title') },
    { key: 'question', label: t('Question'), type: 'content' },
    {
      label: t('Responses'),
      array: 'responses',
      fields: [
        { key: 'created', label: t('Created'), type: 'datetime' },
        { key: 'writer', label: t('Writer'), render: (writer) => writer.name },
        { key: 'answer', label: t('Answer'), type: 'content' },
        { key: 'solved', label: t('Solved'), type: 'datetime' },
      ],
    },
  ],
})
