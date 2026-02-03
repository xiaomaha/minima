importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyD0zYOkIjjrcoOxYqI6tT7cq3LyxgYO36A',
  authDomain: 'minima-9f028.firebaseapp.com',
  projectId: 'minima-9f028',
  storageBucket: 'minima-9f028.firebasestorage.app',
  messagingSenderId: '906425046596',
  appId: '1:906425046596:web:159eda4ee639cc7ff58e11',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'New notification'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/image/logo/logo-icon.png',
    data: payload.data,
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const path = event.notification.data?.path || '/dashboard'
  event.waitUntil(clients.openWindow(path))
})
