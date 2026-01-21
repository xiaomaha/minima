import { examV1StartAttempt, type LearningSessionStep } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'
import { toHHMMSS } from '@/shared/utils'
import { SessionStart } from '../../-shared/grading/SessionStart'
import { useSession } from './context'

const SITTING = 1 as LearningSessionStep

export const GettingStarted = () => {
  const { t } = useTranslation()

  const [session, { setStore, refetch }] = useSession()
  const s = () => session.data!

  const startAttempt = async () => {
    const { data } = await examV1StartAttempt({ path: { id: s().exam.id } })
    setStore('data', 'attempt', data)
    setStore('data', 'otpToken', undefined)
    setStore('data', 'step', SITTING)
  }

  const refreshToken = async () => {
    await refetch()
  }

  return (
    <SessionStart
      sessionKind="exam"
      codeTitle={s().exam.honorCode.title}
      code={s().exam.honorCode.code}
      otpToken={s().otpToken}
      started={s().step > 0}
      onSubmit={startAttempt}
      onTimeout={refreshToken}
    >
      <div class="overflow-x-auto">
        <table class="table w-full table-sm text-base-content/80">
          <caption class="text-center text-sm font-bold my-4">{t('Exam Information')}</caption>
          <tbody>
            <tr>
              <td>{t('Exam Period')}</td>
              <td>{`${new Date(s().accessDate.start).toLocaleDateString()} ~ ${new Date(s().accessDate.end).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('Grading Due')}</td>
              <td>{`${new Date(s().gradingDate.gradeDue).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('Appeal Deadline')}</td>
              <td>{`${new Date(s().gradingDate.appealDeadline).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('Grade Confirm Due')}</td>
              <td>{`${new Date(s().gradingDate.confirmDue).toLocaleDateString()}`}</td>
            </tr>
            <tr>
              <td>{t('Duration / Passing Point')}</td>
              <td>
                {t('{{minutes}} minutes', { minutes: toHHMMSS(s().exam.durationSeconds) })}
                {' / '}
                {t('{{count}} point', { count: s().exam.passingPoint })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SessionStart>
  )
}
