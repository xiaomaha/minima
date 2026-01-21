import { type JSX, Show } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { WindowButton } from './WindowButtion'

interface Props {
  open: boolean
  onClose: () => void
  title?: JSX.Element
  children: JSX.Element
  boxClass?: string
}

export const Dialog = (props: Props) => {
  const { t } = useTranslation()
  return (
    <dialog class="modal" open={props.open}>
      <form method="dialog" class="modal-backdrop">
        <button type="button" onClick={() => props.onClose()} />
      </form>
      <Show when={props.open}>
        <div class={`modal-box p-0 flex flex-col ${props.boxClass}`}>
          <div class="flex p-4 text-base-content/30 gap-2">
            <WindowButton title={t('Close')} colorClass="text-rose-500" onClick={props.onClose} />
            <Show when={props.title}>
              <div class="text-sm font-semibold">{props.title}</div>
            </Show>
          </div>
          <div class="flex-1 overflow-y-auto">{props.children}</div>
        </div>
      </Show>
    </dialog>
  )
}
