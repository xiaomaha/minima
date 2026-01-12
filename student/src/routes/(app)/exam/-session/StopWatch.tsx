import { useTransContext } from '@mbarzda/solid-i18next'
import { IconStopwatch } from '@tabler/icons-solidjs'
import { createEffect, createResource, createSignal, ErrorBoundary, onCleanup, Show } from 'solid-js'
import { examV1GetTimestamp } from '@/api'
import { toHHMMSS } from '@/shared/utils'

interface Props {
  started: Date
  durationSeconds: number
  onTimeout: () => void
}

export const StopWatch = (props: Props) => {
  const [t] = useTransContext()

  return (
    <ErrorBoundary
      fallback={(_, reset) => (
        <div class="alert alert-warning">
          <IconStopwatch />
          <div>
            <h3 class="font-bold mb-2">{t('Unable to display timer')}</h3>
            <div class="text-sm">
              {t('Exam time is still running. Submit before {{duration}} elapses from the start {{start}}.', {
                duration: toHHMMSS(props.durationSeconds),
                start: toHHMMSS(props.started.getTime() / 1000),
              })}
            </div>
          </div>
          <button type="button" class="btn btn-sm" onClick={() => reset()}>
            {t('Retry')}
          </button>
        </div>
      )}
    >
      <StopWatchInner {...props} />
    </ErrorBoundary>
  )
}

const StopWatchInner = (props: Props) => {
  const [tick, setTick] = createSignal(0)

  const [serverTime] = createResource(async () => {
    for (let retries = 0; retries < 5; retries++) {
      const { data } = await examV1GetTimestamp({ throwOnError: false })
      if (data !== undefined) return data
      if (retries < 4) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    throw new Error('Failed to fetch server time after 5 retries')
  })

  const interval = setInterval(() => setTick((t) => t + 1), 1000)
  onCleanup(() => clearInterval(interval))

  const startedTime = () => props.started.getTime() / 1000
  const elapsed = () => (serverTime() ? Math.max(0, serverTime()! + tick() - startedTime()) : 0)
  const remaining = () => Math.max(0, props.durationSeconds - elapsed())

  createEffect(() => {
    if (remaining() <= 0 && !serverTime.loading && !serverTime.error) {
      props.onTimeout()
    }
  })

  return (
    <div class="alert" classList={{ 'alert-error': remaining() < 60 * 5, 'alert-success': remaining() >= 60 * 5 }}>
      <IconStopwatch />
      <div class="flex gap-4 items-center font-mono">
        <span>
          {toHHMMSS(remaining())} / {toHHMMSS(props.durationSeconds)}
        </span>
        <Show when={serverTime.loading}>
          <span class="loading loading-spinner loading-sm" />
        </Show>
      </div>
    </div>
  )
}
