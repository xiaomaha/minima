import { createRouter, RouterProvider } from '@tanstack/solid-router'
import ky from 'ky'
import { render } from 'solid-js/web'
import { routeTree } from './routeTree.gen'
import './styles.css'
import { client } from './api/client.gen'
import { accessContextParam } from './context'
import { getUserLanguage } from './routes/(app)/account/-store'
import { handleApiError } from './shared/error'

// error
client.interceptors.error.use(handleApiError)

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ({ error }) => {
    console.error(error)
    // TODO
    return <div>Error: {error.message}</div>
  },
})

router.subscribe('onResolved', () => {
  const userLang = getUserLanguage() || navigator.language

  client.setConfig({
    ky: ky.create({
      // permission context
      searchParams: accessContextParam(),
      // set language
      headers: {
        'Accept-Language': userLang,
      },
    }),
  })
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
