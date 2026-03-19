import { createFileRoute } from '@tanstack/solid-router'
import { type DeskLearningTermSpec, deskV1GetTerms } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/learning/term')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskLearningTermSpec> => ({
  title: t('Term'),
  cacheKey: 'deskV1GetTerms',
  searchable: true,
  fetcher: deskV1GetTerms,
  columns: [
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'name', label: t('Name') },
    { key: 'userCount', label: t('User') },
    { key: 'enrollmentCount', label: t('Enrollment') },
    { key: 'breakdown', label: t('Breakdown'), type: 'badgeList' },
  ],
})
