import { useTransContext } from '@mbarzda/solid-i18next'
import { Link } from '@tanstack/solid-router'

interface Props {
  class?: string
}

export const ActivationLink = (props: Props) => {
  const [t] = useTransContext()

  return (
    <div class={`label justify-center ${props.class ?? ''}`}>
      {t('Lost activation email?')}
      <Link to="/activate" class="ml-1 link link-hover">
        {t('Request activation email')}
      </Link>
    </div>
  )
}
