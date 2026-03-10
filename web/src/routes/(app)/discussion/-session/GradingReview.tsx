import { IconHandStop } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import { type AppealSchema, discussionV1GetOwnPosts } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Appeal } from '../../-shared/grading/Appeal'
import { ScorePanel } from '../../-shared/grading/ScorePanel'
import { useSession } from './context'

export const GradingReview = () => {
  const { t } = useTranslation()
  const [session, { setStore }] = useSession()
  const s = () => session.data!

  const discussion = s().discussion
  const grade = s().grade!
  const possiblePoint = grade.possiblePoint
  const passingPoint = discussion.passingPoint ?? 0
  const postCount = s().postCount!

  const [posts] = createCachedStore(
    'discussionV1GetOwnPosts',
    () => ({ path: { id: s().discussion.id } }),
    async (options) => (await discussionV1GetOwnPosts(options)).data,
  )

  const onCreateAppeal = (appeal: AppealSchema) => {
    setStore('data', 'appeal', appeal)
  }

  const [appealDialogOpen, setAppealDialogOpen] = createSignal(false)
  const question = s().attempt!.question
  const appeal = () => s().appeal

  return (
    <>
      <div class="w-full space-y-12">
        <ScorePanel grade={grade} passingPoint={passingPoint} />

        <div class="label my-1 text-sm">{t('Score Details')}</div>
        <div class="overflow-x-auto">
          <table class="table rounded-box border border-base-content/5 bg-base-100 border-collapse">
            <thead>
              <tr>
                <th class="text-center">{t('Post')}</th>
                <th class="text-center">{t('Reply')}</th>
                <th class="text-center">{t('Tutor Assessment')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">{t('{{count}} post', { count: postCount.post })}</td>
                <td class="text-center">{t('{{count}} reply', { count: postCount.reply })}</td>
                <td class="text-center text-green-600">{grade.feedback.tutorAssessment}</td>
              </tr>
              <tr>
                <td class="text-center">{t('{{count}} point', { count: grade.earnedDetails.post })}</td>
                <td class="text-center">{t('{{count}} point', { count: grade.earnedDetails.reply })}</td>
                <td class="text-center">
                  {grade.earnedDetails.tutorAssessment
                    ? t('{{count}} point', { count: grade.earnedDetails.tutorAssessment })
                    : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Show
          when={
            appeal() ||
            (!grade.confirmed && new Date(s().gradingDate.confirmDue) > new Date() && grade.earnedPoint < possiblePoint)
          }
        >
          <div class="text-right">
            <button type="button" class="btn btn-sm btn-neutral" onClick={() => setAppealDialogOpen(true)}>
              <IconHandStop size={20} />
              {!appeal() ? t('Appeal available') : appeal()?.review ? t('Appeal reviewed') : t('Appeal pending')}
            </button>
          </div>
        </Show>

        <div class="label my-1 text-sm">{t('My posts and replies')}</div>
        <div class="space-y-6">
          <For each={posts.data}>
            {(post, i) => (
              <div class="card shadow-sm">
                <div class="card-body">
                  <div class="flex items-center gap-4 text-sm label">
                    <span class="text-sm opacity-40">#{i() + 1}</span>
                    <time>{new Date(post.created).toLocaleString()}</time>
                  </div>
                  <div class="card-title mb-4">
                    {post.title}
                    <span
                      class="badge badge-sm ml-2"
                      classList={{
                        'badge-primary': !post.parentId,
                        'badge-success': !!post.parentId,
                      }}
                    >
                      {post.parentId ? t('Reply') : t('Post')}
                    </span>
                  </div>
                  <ContentViewer content={post.body} />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
      <Dialog
        title={t('Discussion Grading Appeal')}
        boxClass="max-w-3xl"
        open={!!appealDialogOpen()}
        onClose={() => setAppealDialogOpen(false)}
      >
        <Appeal
          appeal={appeal()}
          appLabel="discussion"
          model="question"
          questionId={question.id}
          onCreate={onCreateAppeal}
        />
      </Dialog>
    </>
  )
}
