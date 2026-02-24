import { Link } from '@tanstack/solid-router'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  class?: string
}

export const LoginLink = (props: Props) => {
  const { t } = useTranslation()

  return (
    <div class={`label justify-center ${props.class ?? ''}`}>
      {t('Already have an account?')}
      <Link to="/login" class="ml-1 link link-hover">
        {t('Login here')}
      </Link>
    </div>
  )
}
