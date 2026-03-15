import { createRoot } from 'solid-js'
import type { DeviceSchema } from '@/api'
import { createPersistentSignal } from '@/shared/solid/persistent-signal'

const [currentDevice, setCurrentDevice] = createRoot(() => {
  return createPersistentSignal<DeviceSchema | null>('device:current', null, localStorage)
})

export { currentDevice, setCurrentDevice }
