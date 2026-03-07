import { Match, Show, Switch } from 'solid-js'
import { type LearningSessionStep, quizV1GetSession } from '@/api'
import { Dialog } from '@/shared/Diaglog'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { GettingStarted } from './GettingStarted'
import { QuizForm } from './QuizForm'

interface Props {
  id: string
  open: boolean
  onClose: () => void
  inlineContext?: { media: string } //  inline quiz inside media
}

const SITTING = 1 as LearningSessionStep

export const QuizDialog = (props: Props) => {
  const { t } = useTranslation()

  const [session, { setStore }] = createCachedStore(
    'quizV1GetSession',
    () => ({ path: { id: props.id }, query: { ...props.inlineContext } }),
    async (options) => {
      const { data } = await quizV1GetSession(options)
      return data
    },
  )

  const s = () => session.data

  return (
    <Dialog title={t('Quiz')} boxClass="max-w-3xl h-130 max-h-screen" open={props.open} onClose={props.onClose}>
      <Show when={!session.loading} fallback={<LoadingOverlay class="static" />}>
        <Show when={s()}>
          {(ss) => (
            <Switch>
              <Match when={ss().step < SITTING}>
                <GettingStarted session={ss()} setStore={setStore} inlineContext={props.inlineContext} />
              </Match>

              <Match when={ss().step >= SITTING}>
                <QuizForm session={ss()} setStore={setStore} inlineContext={props.inlineContext} />
              </Match>
            </Switch>
          )}
        </Show>
      </Show>
    </Dialog>
  )
}
