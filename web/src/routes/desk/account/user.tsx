import { createFileRoute } from '@tanstack/solid-router'
import { type DeskUserDetailSpec, type DeskUserSpec, deskV1GetUserDetail, deskV1GetUsers } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { useTranslation } from '@/shared/solid/i18n'
import { Page } from '../-desk/Page'
import type { TableConfig } from '../-desk/types'

export const Route = createFileRoute('/desk/account/user')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return <Page config={config(t)} />
}

const config = (t: (key: string) => string): TableConfig<DeskUserSpec, DeskUserDetailSpec> => ({
  title: t('User'),
  cacheKey: 'deskv1GetUsers',
  searchable: true,
  fetcher: deskV1GetUsers,
  detailFetcher: (options) => deskV1GetUserDetail(options),
  columns: [
    { key: 'name', label: t('Avatar'), render: (_, row) => <Avatar user={row} size="sm" rounded /> },
    { key: 'modified', label: t('Modified'), type: 'distanceToNow' },
    { key: 'name', label: t('Name') },
    { key: 'email', label: t('Email') },
    { key: 'nickname', label: t('Nickname') },
    { key: 'language', label: t('Language'), type: 'badge' },
    { key: 'isActive', label: t('Active'), type: 'boolean' },
    { key: 'roles', label: t('Roles'), type: 'badgeList' },
    { key: 'realms', label: t('Realms'), type: 'badgeList' },
    { key: 'lastLogin', label: t('Last Login'), type: 'distanceToNow' },
  ],
  detail: [
    { key: 'created', label: t('Created'), type: 'datetime' },
    { key: 'phone', label: t('Phone') },
    { key: 'birthDate', label: t('Birth Date'), type: 'date' },
    {
      label: t('Change History'),
      array: 'histories',
      fields: [
        { key: 'pghCreatedAt', label: t('Date'), type: 'datetime' },
        { key: 'email', label: t('Email') },
        { key: 'name', label: t('Name') },
        { key: 'phone', label: t('Phone') },
        { key: 'birthDate', label: t('Birth Date'), type: 'date' },
      ],
    },
  ],
})
