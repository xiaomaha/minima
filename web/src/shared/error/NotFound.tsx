import { SUBDOMAINS } from '@/config'
import { useTranslation } from '../solid/i18n'

export const NotFound = () => {
  const { t } = useTranslation()
  const subdomain = location.hostname.split('.')[0]
  const isValidSubdomain = !subdomain || (SUBDOMAINS as readonly string[]).includes(subdomain)

  return (
    <div class="min-h-svh flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div class="flex flex-col items-center gap-2">
        <span class="text-8xl font-black text-base-content/10 select-none leading-none">404</span>
        <h1 class="text-2xl font-bold text-base-content">
          {isValidSubdomain ? t('Page Not Found') : t('Unknown Address')}
        </h1>
        <p class="text-base-content/60 max-w-sm text-sm">
          {isValidSubdomain
            ? t('The page you are looking for does not exist or you do not have permission to access it.')
            : t('Please check the address and try again.')}
        </p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onClick={() => history.back()}>
        {t('Go Back')}
      </button>
    </div>
  )
}
