import { createFileRoute } from '@tanstack/solid-router'
import { type DeskEnrollmentDetailSpec, type DeskEnrollmentSpec, deskV1GetEnrollments } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/learning/enrollment')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskEnrollmentSpec, DeskEnrollmentDetailSpec> => ({
  title: t('Enrollment'),
  cacheKey: 'deskV1GetEnrollments',
  searchable: true,
  fetcher: deskV1GetEnrollments,
  columns: [
    { key: 'user', label: t('User'), render: (user) => <Avatar user={user} size="sm" rounded /> },
    { key: 'enrolled', label: t('Enrolled'), type: 'distanceToNow' },
    { key: 'active', label: t('Active'), type: 'boolean' },
    { key: 'start', label: t('Start'), type: 'date' },
    { key: 'end', label: t('End'), type: 'date' },
    { key: 'contentType', label: t('Type'), type: 'badge', value: (contentType) => contentType.model },
    {
      key: 'enrolledBy',
      label: t('Enrolled by'),
      render: (enrolledBy) => enrolledBy && <Avatar user={enrolledBy} size="sm" rounded />,
    },
    { key: 'label', label: t('Label'), render: (label) => <span class="line-clamp-1">{label}</span> },
    { key: 'term', label: t('Term'), render: (term) => <span class="line-clamp-1">{term}</span> },
  ],
  detail: [
    { key: 'user', label: t('User'), render: (user) => user.name },
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'label', label: t('Label') },
    { key: 'term', label: t('Term') },
    { key: 'archive', label: t('Archive'), type: 'datetime' },
    { key: 'enrolledBy', label: t('Enrolled'), render: (enrolledBy) => enrolledBy?.name },
    {
      label: t('Change History'),
      array: 'histories',
      fields: [
        { key: 'active', label: t('Active'), type: 'boolean' },
        { key: 'start', label: t('Start'), type: 'date' },
        { key: 'end', label: t('End'), type: 'date' },
        { key: 'archive', label: t('Archive'), type: 'date' },
      ],
    },
  ],
})
