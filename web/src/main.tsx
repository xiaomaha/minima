import { RouterProvider } from '@tanstack/solid-router'
import { render } from 'solid-js/web'
import './styles.css'
import { client } from './api/client.gen'
import { accessContextParam } from './context'
import { router } from './router'
import { getUserLanguage } from './routes/student/(account)/-store'
import { handleApiError } from './shared/error/error'

// error
client.instance.interceptors.response.use((res) => res, handleApiError)

client.instance.interceptors.request.use((config) => {
  // attach permission context
  config.params = { ...config.params, ...accessContextParam() }
  config.headers.set('Accept-Language', getUserLanguage() || navigator.language)
  return config
})

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')
if (rootElement) {
  render(() => <RouterProvider router={router} />, rootElement)
}
