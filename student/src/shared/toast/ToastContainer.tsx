import { useTransContext } from '@mbarzda/solid-i18next'
import { For } from 'solid-js'
import { Portal } from 'solid-js/web'
import { WindowButton } from '../WindowButtion'
import { removeToast, toasts } from './store'

export const ToastContainer = () => {
  const [t] = useTransContext()
  return (
    <Portal>
      <div class="z-1000 min-w-sm fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col gap-2">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={'alert alert-soft w-full shadow-2xl relative'}
              classList={{
                'alert-info': toast.type === 'info',
                'alert-success': toast.type === 'success',
                'alert-warning': toast.type === 'warning',
                'alert-error': toast.type === 'error',
              }}
            >
              <div>
                <WindowButton
                  title={t('Close')}
                  colorClass="text-red-500"
                  onClick={() => removeToast(toast.id)}
                  class="absolute right-2 top-2"
                />
                <h5 class="font-bold">{toast.title}</h5>
                <p class="mb-0">{toast.message}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Portal>
  )
}
