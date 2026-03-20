import { createFileRoute } from '@tanstack/solid-router'
import { type DeskCatalogDetailSpec, type DeskCatalogSpec, deskV1GetCatalogDetail, deskV1GetCatalogs } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { renderValue } from '../-desk/helper'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/learning/catalog')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskCatalogSpec, DeskCatalogDetailSpec> => ({
  title: t('Catalog'),
  cacheKey: 'deskV1GetCatalogs',
  searchable: true,
  fetcher: deskV1GetCatalogs,
  detailFetcher: (options) => deskV1GetCatalogDetail(options),
  columns: [
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'name', label: t('Name') },
    { key: 'active', label: t('Active'), type: 'boolean' },
    { key: 'public', label: t('Public'), type: 'boolean' },
    { key: 'availableFrom', label: t('Available From'), type: 'date' },
    { key: 'availableUntil', label: t('Available Until'), type: 'date' },
    { key: 'itemCount', label: t('Item Count') },
  ],
  detail: [
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'description', label: t('Description') },
    { key: 'breakdown', label: t('Breakdown'), type: 'badgeList' },
    {
      key: 'thumbnail',
      label: t('Thumbnail'),
      render: (thumbnail) => <img class="object-cover h-16 aspect-auto  rounded" src={thumbnail} alt="" />,
    },
    {
      label: t('Items'),
      array: 'items',
      fields: [
        { key: 'ordering', label: t('Ordering') },
        { key: 'label', label: t('Label') },
        {
          key: 'contentType',
          label: t('Content Type'),
          type: 'badge',
          render: (contentType) => renderValue(contentType.model, 'badge'),
        },
      ],
    },
  ],
})
