import { useTransContext } from '@mbarzda/solid-i18next'
import { Link } from '@tanstack/solid-router'

export const LoginLink = () => {
  const [t] = useTransContext()

  return (
    <div class="label justify-center">
      {t('Already have an account?')}
      <Link to="/login" class="ml-1 link link-hover">
        {t('Login here')}
      </Link>
    </div>
  )
}
