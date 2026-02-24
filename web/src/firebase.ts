import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { FIREBASE_CONFIG, V_API_KEY } from './config'

const app = initializeApp(FIREBASE_CONFIG)

const getMessagingInstance = () => {
  if (typeof window === 'undefined') return null
  return getMessaging(app)
}

export const getFcmToken = async () => {
  const messaging = getMessagingInstance()
  if (!messaging) return null
  return await getToken(messaging, { vapidKey: V_API_KEY })
}

export const onMessageListener = () =>
  new Promise((resolve) => {
    const messaging = getMessagingInstance()
    if (!messaging) return resolve(null)
    onMessage(messaging, (payload) => {
      resolve(payload)
    })
  })
