import { Link } from '@tanstack/solid-router'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  class?: string
}

export const ActivationLink = (props: Props) => {
  const { t } = useTranslation()

  return (
    <div class={`label justify-center ${props.class ?? ''}`}>
      {t('Lost activation email?')}
      <Link to="/auth/activate" class="ml-1 link link-hover">
        {t('Request activation email')}
      </Link>
    </div>
  )
}
