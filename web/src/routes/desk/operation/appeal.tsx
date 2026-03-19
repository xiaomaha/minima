import { createFileRoute } from '@tanstack/solid-router'
import { type DeskAppealSpec, deskV1GetAppeals } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/operation/appeal')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskAppealSpec> => ({
  title: t('Appeal'),
  cacheKey: 'deskV1GetAppeals',
  searchable: true,
  fetcher: deskV1GetAppeals,
  columns: [
    { key: 'learner', label: t('Learner'), render: (learner) => <Avatar user={learner} size="sm" rounded /> },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    {
      key: 'explanation',
      label: t('Explanation'),
      render: (explanation) => <span class="line-clamp-1">{extractText(explanation)}</span>,
    },
    {
      key: 'reviewer',
      label: t('Reviewer'),
      render: (reviewer) => reviewer && <Avatar user={reviewer} size="sm" rounded />,
    },
    { key: 'solved', label: t('Solved'), type: 'boolean' },
  ],
  detail: [
    { key: 'learner', label: t('Learner'), render: (learner) => learner.name },
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'explanation', label: t('Explanation'), type: 'content' },
    { key: 'reviewer', label: t('Reviewer'), render: (reviewer) => reviewer?.name },
    { key: 'review', label: t('Review'), type: 'content' },
    { key: 'solved', label: t('Solved'), type: 'boolean' },
  ],
})
