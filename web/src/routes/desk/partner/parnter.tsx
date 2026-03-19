import { createFileRoute } from '@tanstack/solid-router'
import { type DeskPartnerSpec, deskV1GetPartners } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/partner/parnter')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskPartnerSpec> => ({
  title: t('Partner'),
  cacheKey: 'deskV1GetPartners',
  searchable: true,
  fetcher: deskV1GetPartners,
  columns: [
    { key: 'logo', label: t('Logo'), type: 'thumbnail' },
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'name', label: t('Name') },
    { key: 'realm', label: t('Realm'), type: 'badge' },
    { key: 'phone', label: t('Phone') },
    { key: 'email', label: t('Email') },
    { key: 'website', label: t('Website') },
  ],
})
