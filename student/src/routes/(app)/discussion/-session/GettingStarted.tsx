import { useTransContext } from '@mbarzda/solid-i18next'
import { discussionV1StartAttempt, type LearningSessionStep } from '@/api'
import { SessionStart } from '../../-shared/grading/SessionStart'
import { useSession } from './context'

const SITTING = 1 as LearningSessionStep

export const GettingStarted = () => {
  const [t] = useTransContext()

  const [session, { setStore, refetch }] = useSession()
  const s = () => session.data!

  const startAttempt = async () => {
    const { data } = await discussionV1StartAttempt({ path: { id: s().discussion.id } })
    setStore('data', 'attempt', data)
    setStore('data', 'step', SITTING)
    setStore('data', 'otpToken', undefined)
  }

  const refreshToken = async () => {
    await refetch()
  }

  return (
    <SessionStart
      sessionKind="discussion"
      codeTitle={s().discussion.honorCode.title}
      code={s().discussion.honorCode.code}
      otpToken={s().otpToken}
      started={s().step > 0}
      onSubmit={startAttempt}
      onTimeout={refreshToken}
    >
      <div class="overflow-x-auto">
        <table class="table w-full table-sm text-base-content/80">
          <caption class="text-center text-sm font-bold my-4">{t('Discussion Information')}</caption>
          <tbody>
            <tr>
              <td>{t('Discussion Period')}</td>
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
              <td>{t('Passing Score')}</td>
              <td>{t('{{count}} point', { count: s().discussion.passingPoint })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SessionStart>
  )
}
