import { createRouter, RouterProvider } from '@tanstack/solid-router'
import { render } from 'solid-js/web'
import { routeTree } from './routeTree.gen'
import { UnKnown } from './shared/error/UnKnown'
import './styles.css'
import { client } from './api/client.gen'
import { accessContextParam } from './context'
import { getUserLanguage } from './routes/account/-store'
import { handleApiError } from './shared/error/error'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ({ error }) => {
    console.error(error)
    return <UnKnown error={error} />
  },
})

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
