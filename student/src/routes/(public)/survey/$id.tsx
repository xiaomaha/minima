import { useTransContext } from '@mbarzda/solid-i18next'
import { IconChevronLeft, IconHelpCircle } from '@tabler/icons-solidjs'
import { createFileRoute, useCanGoBack, useRouter } from '@tanstack/solid-router'
import { Show, Suspense } from 'solid-js'
import { type SurveySchema, surveyV1GetAnonymousSurvey, surveyV1GetSurvey } from '@/api'
import { store as accountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { LoadingOverlay } from '@/shared/LoadingOverlay'
import { createCachedStore } from '@/shared/solid/cached-store'
import { SurveyForm } from './-SurveyForm'

export const Route = createFileRoute('/(public)/survey/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  const canGoBack = useCanGoBack()
  const router = useRouter()

  const user = accountStore.user
  const [survey] = createCachedStore(
    user ? 'surveyV1GetSurvey' : 'surveyV1GetAnonymousSurvey',
    () => ({ path: { id: params().id } }),
    async (options) => {
      const api = user ? surveyV1GetSurvey : surveyV1GetAnonymousSurvey
      const { data } = await api(options)
      return data
    },
  )

  const handleBack = () => {
    if (canGoBack()) {
      router.history.back()
    } else {
      router.navigate({ to: '/dashboard' })
    }
  }

  return (
    <Suspense fallback={<LoadingOverlay />}>
      <Show when={survey.data}>
        {(s) => (
          <>
            <div
              class="fixed inset-0 bg-base-300 bg-no-repeat bg-cover"
              style={{ 'background-image': `url(${s().thumbnail})` }}
            >
              <div class="fixed inset-0 glass" style={{ '--glass-opacity': '10%', '--glass-reflect-opacity': '0%' }} />
            </div>
            <div class="relative h-full w-full p-2 sm:p-8">
              <div class="card p-4 mx-auto max-w-200 shadow-xs bg-base-100 rounded-3xl">
                <button type="button" class="btn btn-ghost btn-circle absolute right-4 top-4" onClick={handleBack}>
                  <IconChevronLeft />
                </button>
                <div class="card-body">
                  <div class="card-title text-2xl mb-2">{s().title}</div>
                  <p class="label">{s().description}</p>
                  <SurveyInfo survey={s()} />
                  <div class="divider my-8" />
                  <SurveyForm survey={s()} />
                </div>
              </div>
            </div>
          </>
        )}
      </Show>
    </Suspense>
  )
}

const SurveyInfo = (props: { survey: SurveySchema }) => {
  const [t] = useTransContext()

  const survey = props.survey

  return (
    <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
      <table class="table w-full [&_th]:whitespace-nowrap">
        <tbody>
          <tr>
            <th>{t('Researcher')}</th>
            <td>
              <Avatar user={survey.owner} size="sm" />
              <span class="font-semibold ml-2"> {survey.owner.nickname || survey.owner.name}</span>
            </td>
          </tr>
          <tr>
            <th>{t('Survey Target')}</th>
            <td>{survey.audience}</td>
          </tr>
          <tr>
            <th>{t('Results Available')}</th>
            <td>{survey.showResults ? t('immediately after response') : t('Not available')}</td>
          </tr>
          <tr>
            <th>{t('Question Count')}</th>
            <td>{survey.questions.length}</td>
          </tr>
          <Show when={survey.anonymous}>
            <tr>
              <th>
                {t('Privacy Policy')}
                <span class="text-error"> *</span>
              </th>
              <td class="text-primary">
                <div class="flex items-center gap-2">
                  {t('Anonymous survey')}

                  <div class="tooltip" data-tip={t('If you refresh or close the browser, all data will be cleared.')}>
                    <IconHelpCircle size={16} class="text-info" />
                  </div>
                </div>
              </td>
            </tr>
          </Show>
        </tbody>
      </table>
    </div>
  )
}
