import { IconCheck, IconCopy } from '@tabler/icons-solidjs'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  onCopy: (e: MouseEvent) => void
  class?: string
}

export const CopyButton = (props: Props) => {
  const { t } = useTranslation()

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation()

    props.onCopy(e)

    setTimeout(() => {
      const checkbox = e.target as HTMLInputElement
      checkbox.checked = false
    }, 1000 * 3)
  }

  return (
    <label class={`swap btn btn-sm btn-ghost btn-circle ${props.class ?? ''}`} onclick={handleCopy}>
      <input type="checkbox" />
      <IconCheck size={16} class="swap-on" />
      <div class="swap-off" title={t('Copy')}>
        <IconCopy size={16} />
      </div>
    </label>
  )
}
