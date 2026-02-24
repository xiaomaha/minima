import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  title: string
  colorClass: string
  onClick: () => void
  class?: string
}

export const WindowButton = (props: Props) => {
  const { t } = useTranslation()

  return (
    <button type="button" onClick={() => props.onClick()} class={`cursor-pointer group ${props.class ?? ''}`}>
      <svg
        class={`${props.colorClass} hover:brightness-110 active:brightness-125 transition-all`}
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
      >
        <title>{t('Close')}</title>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
      </svg>
    </button>
  )
}
