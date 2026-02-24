import { Show } from 'solid-js'
import { ContentViewer } from '@/shared/ContentViewer'
import { useTranslation } from '@/shared/solid/i18n'
import { useSession } from './context'
import { Thread } from './Thread'

export const Discussion = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  const question = s().attempt!.question
  const possiblePoint = question.postPoint + question.replyPoint + question.tutorAssessmentPoint

  return (
    <>
      <div class="card w-full p-4 md:p-8 bg-base-100 shadow-sm space-y-12">
        <div class="label text-sm flex justify-between">
          <span>{t('Discussion Directive')}</span>
          <div class="badge badge-sm badge-outline">{t('{{count}} point', { count: possiblePoint })}</div>
        </div>

        <div class="text-base/relaxed">{question.directive}</div>

        <Show when={question.supplement}>
          <ContentViewer content={question.supplement!} class="bg-base-content/5 rounded-box p-8" />
        </Show>

        <div>
          <div class="label my-4 text-sm text-base-content/60">{t('Assessment Criteria')}</div>
          <ul class="list-disc pl-4 space-y-2 text-sm text-base-content/60">
            <li>
              <span>
                {t('You need to write {{count}} post about the debate topic.', {
                  count: question.postPoint,
                })}{' '}
                {t('You need to write at least {{count}} character.', {
                  count: question.postMinCharacters,
                })}
              </span>
              <div class="ml-2 badge badge-sm badge-outline">{t('{{count}} point', { count: question.postPoint })}</div>
            </li>
            <li>
              <span>
                {t('You need to write {{count}} reply on posts written by others.', {
                  count: question.replyPoint,
                })}{' '}
                {t('You need to write at least {{count}} character.', {
                  count: question.replyMinCharacters,
                })}
              </span>
              <div class="ml-2 badge badge-sm badge-outline">{t('{{count}} point', { count: question.replyPoint })}</div>
            </li>
            <li>
              <span>{t('Tutor Assessment')}</span>
              <div class="ml-2 badge badge-sm badge-outline">
                {t('{{count}} point', { count: question.tutorAssessmentPoint })}
              </div>
            </li>
          </ul>
        </div>
      </div>
      <Thread />
    </>
  )
}
