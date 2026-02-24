import { courseV1StartEngagement } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { SessionStart } from '../../-shared/grading/SessionStart'
import { useSession } from './context'

interface Props {
  setActiveTab: (tab: string) => void
}

export const GettingStarted = (props: Props) => {
  const { t } = useTranslation()

  const [session, { setStore, refetch }] = useSession()
  const s = () => session.data!

  const startCourseEngagement = async () => {
    const { data } = await courseV1StartEngagement({ path: { id: s().course.id } })
    setStore('data', 'engagement', data)
    setStore('data', 'otpToken', undefined)
    props.setActiveTab('outline')
  }

  const refreshToken = () => {
    refetch()
  }

  return (
    <SessionStart
      sessionKind="course"
      codeTitle={s().course.honorCode.title}
      thumbnail={s().course.thumbnail}
      code={s().course.honorCode.code}
      otpToken={s().otpToken}
      started={!!s().engagement}
      onSubmit={startCourseEngagement}
      onTimeout={refreshToken}
    >
      <div class="overflow-x-auto">
        <table class="table w-full table-sm text-base-content/80">
          <caption class="text-center text-sm font-bold my-4">{t('Course Schedule')}</caption>
          <tbody>
            <tr>
              <td>{t('Start')}</td>
              <td>{`${new Date(s().accessDate.start).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('End')}</td>
              <td>{`${new Date(s().accessDate.end).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('Review')}</td>
              <td>{`${new Date(s().accessDate.archive).toLocaleDateString()}`}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SessionStart>
  )
}
