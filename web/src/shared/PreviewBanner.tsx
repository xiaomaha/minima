import { IconHelpCircle } from '@tabler/icons-solidjs'
import { useTranslation } from './solid/i18n'

export const PreviewBanner = () => {
  const { t } = useTranslation()

  return (
    <div role="alert" class="alert alert-warning bg-warning/60 fixed bottom-8 left-8 z-1000">
      <span class="font-semibold">{t('Preview mode')}</span>
      <span class="tooltip">
        <div class="tooltip-content text-left">
          <span class="text-left">
            {t('You can use all features without any restrictions. Data will be deleted in about an hour.')}
          </span>
        </div>
        <IconHelpCircle size={20} />
      </span>
    </div>
  )
}
