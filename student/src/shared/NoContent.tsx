import { IconSearch } from '@tabler/icons-solidjs'
import type { Component, JSX } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  icon?: Component<{ size: number }>
  message?: string
  children?: JSX.Element
  class?: string
  small?: boolean
}

export const NoContent = (props: Props) => {
  const { t } = useTranslation()
  const Icon = props.icon ?? IconSearch

  return (
    <div
      class={`flex flex-col items-center justify-center w-full h-full gap-4 ${props.class}`}
      classList={{
        'min-h-40': !props.small,
        'min-h-20': props.small,
      }}
    >
      <div class="flex gap-4 items-center justify-center">
        <Icon size={props.small ? 24 : 32} />
        <span
          classList={{
            'text-xl': !props.small,
            'text-base': props.small,
          }}
        >
          {props.message || t('No content found')}
        </span>
      </div>
      {props.children}
    </div>
  )
}
