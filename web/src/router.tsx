import { createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'
import { UnKnown } from './shared/error/UnKnown'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: ({ error }) => {
    console.error(error)
    return <UnKnown error={error} />
  },
})
