import { createRouter, RouterProvider } from '@tanstack/solid-router'
import ky from 'ky'
import { render } from 'solid-js/web'
import i18next from './i18n'
import { routeTree } from './routeTree.gen'
import './styles.css'
import { TransProvider } from '@mbarzda/solid-i18next'
import { client } from './api/client.gen'
import { accessContextParam } from './context'
import { DateLocaleProvider } from './shared/DateLocaleProvider'
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

// permission context
router.subscribe('onResolved', () => {
  client.setConfig({
    ky: ky.create({
      searchParams: accessContextParam(),
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
  render(
    () => (
      <TransProvider instance={i18next}>
        <DateLocaleProvider>
          <RouterProvider router={router} />
        </DateLocaleProvider>
      </TransProvider>
    ),
    rootElement,
  )
}
