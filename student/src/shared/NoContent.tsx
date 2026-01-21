import { useTransContext } from '@mbarzda/solid-i18next'
import { IconSearch } from '@tabler/icons-solidjs'
import type { Component, JSX } from 'solid-js'

interface Props {
  icon?: Component<{ size: number }>
  message?: string
  children?: JSX.Element
}

export const NoContent = (props: Props) => {
  const [t] = useTransContext()
  const Icon = props.icon ?? IconSearch
  return (
    <div class="flex items-center justify-center w-full h-full min-h-60 gap-4">
      <Icon size={36} />
      <span class="text-xl font-light">{props.message || t('noContent')}</span>
      {props.children}
    </div>
  )
}
