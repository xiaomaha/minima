import { createFileRoute } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Match, Show, Suspense, Switch } from 'solid-js'
import { courseV1GetSession } from '@/api'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Inquiry } from '../-shared/Inquiry'
import { Achievement } from './-session/Achievement'
import { Comment } from './-session/Comment'
import { CourseDetail } from './-session/CourseDetail'
import { SessionProvider } from './-session/context'
import { GettingStarted } from './-session/GettingStarted'
import { Outline } from './-session/Outline'
import { Schedule } from './-session/Schedule'

export const Route = createFileRoute('/(app)/course/$id/session')({
  component: RouteComponent,
  wrapInSuspense: true,
})

export default function RouteComponent() {
  const { t } = useTranslation()
  const params = Route.useParams()

  const store = createCachedStore(
    'courseV1GetSession',
    () => ({ path: { id: params().id } }),
    async (options) => {
      const { data } = await courseV1GetSession(options)
      return data
    },
  )

  const s = () => store[0].data

  const [activeTab, setActiveTab] = createSignal<string>()

  createEffect(() => {
    if (s()) {
      setActiveTab(s()!.engagement ? 'outline' : 'starting')
    }
  })

  const tabs = [
    { key: 'starting', label: t('Getting Started') },
    { key: 'outline', label: t('Outline') },
    { key: 'schedule', label: t('Schedule') },
    { key: 'achievement', label: t('Achievement') },
    { key: 'communication', label: t('Communication') },
    { key: 'inquiry', label: t('1:1 Inquiry') },
    { key: 'detail', label: t('Course Detail') },
  ]

  return (
    <Suspense fallback={<LoadingOverlay />}>
      <Show when={s()}>
        {(s) => (
          <div class="mx-auto max-w-5xl">
            <div class="tabs tabs-border overflow-x-auto justify-center">
              <For each={tabs}>
                {(tab) => (
                  <button
                    type="button"
                    class={`text-sm tab whitespace-nowrap ${activeTab() === tab.key ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                )}
              </For>
            </div>

            <h2 class="text-center text-3xl font-bold my-12">{s().course.title}</h2>

            <Suspense fallback={<LoadingOverlay class="static" />}>
              <SessionProvider value={store}>
                <Switch>
                  <Match when={activeTab() === 'starting'}>
                    <GettingStarted />
                  </Match>
                  <Match when={activeTab() === 'outline'}>
                    <Outline />
                  </Match>
                  <Match when={activeTab() === 'schedule'}>
                    <Schedule />
                  </Match>
                  <Match when={activeTab() === 'achievement'}>
                    <Achievement />
                  </Match>
                  <Match when={activeTab() === 'communication'}>
                    <Comment />
                  </Match>
                  <Match when={activeTab() === 'inquiry'}>
                    <Inquiry appLabel="course" model="course" contentId={s().course.id} disabled={!s().engagement} />
                  </Match>
                  <Match when={activeTab() === 'detail'}>
                    <CourseDetail />
                  </Match>
                </Switch>
              </SessionProvider>
            </Suspense>
          </div>
        )}
      </Show>
    </Suspense>
  )
}
