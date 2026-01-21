import { useTranslation } from '@/shared/solid/i18n'
import { Thread } from '../../-shared/thread/Thread'
import { useSession } from './context'

export const Comment = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  return (
    <div class="mx-auto max-w-2xl">
      <Thread
        appLabel="course"
        model="course"
        subjectId={s().course.id}
        title={s().course.title}
        description={t('Write a comment about this course.')}
        options={{
          readOnly: new Date() > new Date(s().accessDate.end) || !s().engagement,
          rating: true,
          reply: true,
        }}
      />
    </div>
  )
}
