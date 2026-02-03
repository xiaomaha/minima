import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { FIREBASE_CONFIG, V_API_KEY } from './config'

const app = initializeApp(FIREBASE_CONFIG)
const messaging = getMessaging(app)

export const getFcmToken = async () => {
  try {
    return await getToken(messaging, { vapidKey: V_API_KEY })
  } catch (error) {
    console.error('FCM token error:', error)
    return null
  }
}

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload)
    })
  })
