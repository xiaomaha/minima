import { IconSearch } from '@tabler/icons-solidjs'
import type { Component, JSX } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  icon?: Component<{ size: number }>
  message?: string
  children?: JSX.Element
}

export const NoContent = (props: Props) => {
  const { t } = useTranslation()
  const Icon = props.icon ?? IconSearch
  return (
    <div class="flex flex-col items-center justify-center w-full h-full min-h-60 gap-4">
      <div class="flex gap-4 items-center justify-center">
        <Icon size={36} />
        <span class="text-xl font-light">{props.message || t('No content found')}</span>
      </div>
      {props.children}
    </div>
  )
}
