import { createFileRoute, redirect } from '@tanstack/solid-router'
import { Match, Switch } from 'solid-js'
import { App as Assignment } from './-assignment/App'
import { App as Course } from './-course/App'
import { App as Discussion } from './-discussion/App'
import { App as Exam } from './-exam/App'
import { App as Media } from './-media/App'
import { App as Quiz } from './-quiz/App'
import { Menu } from './-studio/Menu'
import { App as Survey } from './-survey/App'

export const Route = createFileRoute('/studio/$app/$id')({
  component: RouteComponent,
  beforeLoad: async ({ params }) => {
    if (!['survey', 'quiz', 'exam', 'assignment', 'discussion', 'media', 'course'].includes(params.app)) {
      throw redirect({ to: '/studio' })
    }
  },
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <>
      <div class="py-4 flex flex-col md:flex-row gap-4 mx-auto">
        <Menu class="ml-auto" />
      </div>
      <Switch>
        <Match when={params().app === 'survey'}>
          <Survey id={params().id} />
        </Match>
        <Match when={params().app === 'quiz'}>
          <Quiz id={params().id} />
        </Match>
        <Match when={params().app === 'exam'}>
          <Exam id={params().id} />
        </Match>
        <Match when={params().app === 'assignment'}>
          <Assignment id={params().id} />
        </Match>
        <Match when={params().app === 'discussion'}>
          <Discussion id={params().id} />
        </Match>
        <Match when={params().app === 'media'}>
          <Media id={params().id} />
        </Match>
        <Match when={params().app === 'course'}>
          <Course id={params().id} />
        </Match>
      </Switch>
    </>
  )
}
