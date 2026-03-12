import { IconX } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { formatDistanceToNow } from 'date-fns'
import { createEffect, For, on, Show } from 'solid-js'
import { operationV1DeleteDevice, operationV1GetDevices, operationV1ToggleDeviceActive } from '@/api'
import { PLATFORM_NAME } from '@/config'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { currentDevice, setCurrentDevice } from './-device'

export const Route = createFileRoute('/account/device')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()

  const [devices, { setStore }] = createCachedStore(
    'operationV1GetDevices',
    () => ({}),
    async () => (await operationV1GetDevices()).data,
  )

  const deleteDevice = async (deviceId: number) => {
    await operationV1DeleteDevice({ path: { id: deviceId } })
    setStore('data', (prev) => prev?.filter((d) => d.id !== deviceId))
  }

  const toggleActive = async (deviceId: number, active: boolean) => {
    await operationV1ToggleDeviceActive({ path: { id: deviceId } })
    setStore('data', (prev) => prev.id === deviceId, 'active', !active)
  }

  createEffect(
    on(
      currentDevice,
      (device, prevDevice) => {
        if (!prevDevice && device) {
          if (!devices.data?.some((d) => d === device)) {
            setStore('data', (prev) => prev && [...prev, device])
          }
        }
      },
      { defer: true },
    ),
  )

  return (
    <div class="m-auto max-w-md space-y-4">
      <div class="text-sm label mb-4">
        {t(
          'This device is registered after agreeing to the terms of service in order to receive notifications from {{platform}}.',
          { platform: PLATFORM_NAME },
        )}{' '}
        {t('If you deactivate it, you will no longer receive notifications.')}{' '}
        {t('If you delete it, the device information will be permanently removed.')}
      </div>
      <For each={devices.data}>
        {(device) => (
          <div class="rounded shadow-sm p-4 flex items-center gap-4 justify-between">
            <div class="flex items-center gap-4">
              <div class="text-base-content/60">
                <div class="mb-0.5 text-base-content">
                  {device.deviceName}
                  {device.id === currentDevice()?.id && <span class="ml-2 text-xs label">{t('(current device)')}</span>}
                </div>
                <div class="label text-xs">{formatDistanceToNow(device.created, { addSuffix: true })}</div>
                <div class="text-sm break-all line-clamp-1">{device.token}</div>
              </div>
            </div>

            <label class="label text-xs">
              {device.active ? <span class="badge badge-xs badge-primary">{t('Active')}</span> : null}
              <input
                type="checkbox"
                class="toggle ml-1 toggle-sm"
                checked={!!device.active}
                onchange={() => toggleActive(device.id, device.active)}
              />
            </label>

            <button type="button" class="btn btn-sm btn-ghost btn-circle" onClick={() => deleteDevice(device.id)}>
              <IconX size={20} class="text-red-600" />
            </button>
          </div>
        )}
      </For>

      <Show when={devices.data && currentDevice() && !devices.data.some((d) => d.id === currentDevice()!.id)}>
        <div class="my-8 text-center">
          <button type="button" class="btn btn-link" onClick={() => setCurrentDevice(null)}>
            {t('Enable notifications on this device')}
          </button>
        </div>
      </Show>
    </div>
  )
}
