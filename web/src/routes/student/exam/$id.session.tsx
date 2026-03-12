import { IconClockPause, IconExclamationCircle, IconPencil } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Match, Show, Suspense, Switch } from 'solid-js'
import { examV1GetSession, type LearningSessionStep } from '@/api'
import { LEARNING_STEP_MAP } from '@/config'
import { accessContextParam } from '@/context'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { safeLocaleString } from '@/shared/utils'
import { FinalScore } from '../-shared/grading/FinalScore'
import { SessionProvider } from './-session/context'
import { GettingStarted } from './-session/GettingStarted'
import { GradingReview } from './-session/GradingReview'
import { StopWatch } from './-session/StopWatch'
import { TakeExam } from './-session/TakeExam'

export const Route = createFileRoute('/student/exam/$id/session')({
  component: RouteComponent,
})

const TIMEOUT = 2 as LearningSessionStep

function RouteComponent() {
  const { t } = useTranslation()
  const params = Route.useParams()

  const store = createCachedStore(
    'examV1GetSession',
    () => ({ path: { id: params().id }, query: accessContextParam() }),
    async (options) => (await examV1GetSession(options)).data,
  )

  const s = () => store[0].data

  const STEPS = [t('Getting started'), t('Take the Exam'), t('Grading Review'), t('Final score')]
  const lastStep = () => LEARNING_STEP_MAP[s()?.step ?? 0]
  const [activeStep, setActiveStep] = createSignal(lastStep())

  createEffect(() => {
    if (s()) setActiveStep(lastStep())
  })

  const jumpToStep = (step: number) => {
    if (step <= lastStep()) setActiveStep(step)
  }

  const handleTimeout = () => {
    store[1].setStore('data', 'step', TIMEOUT)
  }

  return (
    <Suspense fallback={<LoadingOverlay />}>
      <Show when={s()}>
        {(s) => (
          <SessionProvider value={store}>
            <div class="mx-auto max-w-5xl">
              <ul class="steps w-full">
                <For each={STEPS}>
                  {(step, i) => (
                    <li
                      onclick={() => jumpToStep(i())}
                      class="step"
                      classList={{
                        'cursor-pointer step-primary': i() <= lastStep(),
                        'after:outline-4 after:outline-success': i() === activeStep(),
                      }}
                    >
                      <span
                        class="text-base-content/60 pt-2 text-sm"
                        classList={{ 'text-base-content/90 font-bold': i() === activeStep() }}
                      >
                        {step}
                      </span>
                      <span class="text-xs text-base-content/60">
                        <Switch>
                          <Match when={i() === 0 && lastStep() > 0}>{safeLocaleString(s().attempt?.started)}</Match>
                          <Match when={i() === 1 && lastStep() > 0}>{safeLocaleString(s().submission?.created)}</Match>
                          <Match when={i() === 2 && lastStep() > 1}>{safeLocaleString(s().grade?.completed)}</Match>
                          <Match when={i() === 3 && lastStep() > 2}>{safeLocaleString(s().grade?.completed)}</Match>
                        </Switch>
                      </span>
                    </li>
                  )}
                </For>
              </ul>

              <h2 class="text-center text-3xl font-bold my-12">{s().exam.title}</h2>

              <div
                class="max-w-lg mx-auto flex justify-center my-8"
                classList={{ 'sticky top-4 z-10': s().step === 1 }}
              >
                <Switch>
                  <Match when={s().step === 1}>
                    <Suspense fallback={<LoadingOverlay class="static" />}>
                      <StopWatch
                        started={new Date(s().attempt!.started)}
                        durationSeconds={s().exam.durationSeconds}
                        onTimeout={handleTimeout}
                      />
                    </Suspense>
                  </Match>
                  <Match when={s().step === 2}>
                    <div class="alert">
                      <IconExclamationCircle />
                      <div>
                        <h3 class="font-bold mb-2">{t('Exam time over')}</h3>
                        <div class="text-xs">{t('You timed out without submitting the exam.')}</div>
                      </div>
                    </div>
                  </Match>
                  <Match when={s().step === 3}>
                    <div class="alert alert-warning">
                      <IconClockPause />
                      <div>
                        <h3 class="font-bold mb-2">{t('Grading in Progress')}</h3>
                        <div class="text-xs">
                          {t('Grading is expected to be completed by {{date}}.', {
                            date: new Date(s().gradingDate.gradeDue).toLocaleDateString(),
                          })}
                        </div>
                      </div>
                    </div>
                  </Match>
                  <Match when={s().step === 4}>
                    <div class="alert alert-info">
                      <IconPencil />
                      <div>
                        <h3 class="font-bold mb-2">{t('Grading Review')}</h3>
                        <div class="text-xs">
                          {t('You can submit appeals for incorrect answers until {{date}}.', {
                            date: new Date(s().gradingDate.appealDeadline).toLocaleDateString(),
                          })}
                        </div>
                        <div class="text-xs">
                          {t('The final grade confirmation due is {{date}}.', {
                            date: new Date(s().gradingDate.confirmDue).toLocaleDateString(),
                          })}
                        </div>
                      </div>
                    </div>
                  </Match>
                </Switch>
              </div>

              <Switch>
                <Match when={activeStep() === 0}>
                  <GettingStarted />
                </Match>
                <Match when={activeStep() === 1}>
                  <TakeExam />
                </Match>
                <Match when={activeStep() === 2}>
                  <GradingReview />
                </Match>
                <Match when={activeStep() === 3}>
                  <FinalScore session={s()} passingPoint={s().exam.passingPoint} />
                </Match>
              </Switch>
            </div>
          </SessionProvider>
        )}
      </Show>
    </Suspense>
  )
}
