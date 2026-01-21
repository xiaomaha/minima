import { createSignal, For, Show } from 'solid-js'
import { type CourseDetailSchema, courseV1GetDetail } from '@/api'
import { COURSE_PREVIEW_FALLBACK_URL } from '@/config'
import { Avatar } from '@/shared/Avatar'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { VideoPlayer } from '@/shared/VideoPlayer'
import { useSession } from './context'

export const CourseDetail = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  const [courseDetail] = createCachedStore(
    'coursev1GetDetail',
    () => ({ path: { id: s().course.id } }),
    async (options) => {
      const { data } = await courseV1GetDetail(options)
      return data
    },
  )

  return (
    <Show when={courseDetail.data}>
      {(data) => {
        const detail = data()
        return (
          <div class="mx-auto my-4">
            <div class="flex flex-col gap-12">
              <div class="w-full max-w-4xl mx-auto aspect-video rounded-lg overflow-hidden">
                <VideoPlayer src={detail.previewUrl || COURSE_PREVIEW_FALLBACK_URL} />
              </div>

              <div>
                <h3 class="text-2xl font-bold mb-4">{t('Frequently Asked Questions')}</h3>
                <Faq course={detail} />
              </div>

              <div>
                <h3 class="text-2xl font-bold mb-4">{t('Introduction')}</h3>
                <Introduction course={detail} />
              </div>

              <div>
                <h3 class="text-2xl font-bold mb-4">{t('Instructors')}</h3>
                <Instructors course={detail} />
              </div>

              <div>
                <h3 class="text-2xl font-bold mb-4">{t('Certificates')}</h3>
                <Certificate course={detail} />
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

const Introduction = (props: { course: CourseDetailSchema }) => {
  const { t } = useTranslation()

  return (
    <div class="flex flex-col gap-6">
      <div class="flex gap-2">
        <div class="badge badge-primary">{t('Level: {{ level }}', { level: props.course.level })}</div>
        <div class="badge badge-primary">
          {t('Effort Hours: {{ effortHours }}', { effortHours: props.course.effortHours })}
        </div>
      </div>
      <p class="text-gray-600">{props.course.description}</p>
      <div class="flex flex-col">
        <div class="font-semibold">{t('Who can take this course?')}</div>
        <p class="text-gray-600">{props.course.audience}</p>
      </div>
      <div class="flex flex-col">
        <div class="font-semibold">{t('Objectives of the course')}</div>
        <p class="text-gray-600">{props.course.objective}</p>
      </div>

      <Show when={props.course.categories.length > 0}>
        <div class="flex flex-col">
          <div class="font-semibold">{t('Categories')}</div>
          <ul class="list-disc">
            <For each={props.course.categories}>
              {(category) => <li class="mt-0 py-1">{`${category.ancestors.join(' / ')} / ${category.name}`}</li>}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}

const Certificate = (props: { course: CourseDetailSchema }) => {
  const { t } = useTranslation()
  const certificates = () => props.course.certificates

  return (
    <Show when={certificates().length > 0} fallback={<p>{t('No certificate is issued for this course.')}</p>}>
      <div class="flex flex-col gap-4">
        <div class="text-sm text-gray-500">
          {t('Certificate will be issued to learners who successfully complete the course.')}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <For each={certificates()}>
            {(certificate) => (
              <div class="flex gap-4 w-full">
                <div class="w-64 shrink-0">
                  <div class="aspect-[1/1.4]">
                    <img
                      src={certificate.thumbnail}
                      class="w-full h-full object-cover rounded-md border border-gray-300"
                      alt={certificate.name}
                    />
                  </div>
                </div>
                <div class="flex flex-col gap-1 mt-4">
                  <h4 class="text-xl font-bold">{certificate.name}</h4>
                  <p class="text-sm">{certificate.description}</p>
                  <div class="flex gap-2 items-center mt-4">
                    <div class="avatar avatar-placeholder">
                      <div class="w-10 rounded-full bg-base-300">
                        <Show
                          when={certificate.issuer.logo}
                          fallback={<span class="text-xl">{certificate.issuer.name[0]}</span>}
                        >
                          <img src={certificate.issuer.logo!} alt={certificate.issuer.name} />
                        </Show>
                      </div>
                    </div>
                    <div class="text-lg font-semibold">{certificate.issuer.name}</div>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}

const Faq = (props: { course: CourseDetailSchema }) => {
  const questions = () => props.course.faqItems
  const [openId, setOpenId] = createSignal<number | null>(0)

  return (
    <div class="join join-vertical bg-base-100 w-full">
      <For each={questions()}>
        {(question) => (
          <div class="collapse collapse-arrow join-item border-base-300 border">
            <input
              type="checkbox"
              checked={openId() === question.id}
              onChange={() => setOpenId(openId() === question.id ? null : question.id)}
            />
            <div class="collapse-title font-semibold">
              <div class="flex gap-2 items-center">
                <span class="text-sm text-gray-500">{new Date(question.modified).toLocaleDateString()}</span>
                <span class="text-sm" classList={{ 'line-clamp-1': openId() !== question.id }}>
                  {question.question}
                </span>
              </div>
            </div>
            <div class="collapse-content text-sm">
              <p>{question.answer}</p>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}

const Instructors = (props: { course: CourseDetailSchema }) => {
  const { t } = useTranslation()
  const instructors = () => props.course.instructors

  return (
    <Show when={instructors().length > 0} fallback={<p>{t('No instructors are assigned for this course.')}</p>}>
      <div class="flex flex-col gap-6">
        <For each={instructors()}>
          {(instructor) => (
            <div class="flex flex-row gap-6 items-start">
              <Avatar user={instructor} size="3xl" class="mt-4" />
              <div class="flex flex-col gap-2">
                <h4 class="text-xl font-bold flex gap-2 items-center">
                  {instructor.name}
                  <Show when={instructor.lead}>
                    <div class="badge badge-outline badge-sm badge-info">{t('Lead')}</div>
                  </Show>
                </h4>
                <p class="text-sm text-gray-500">{instructor.about}</p>
                <ul class="list-disc list-inside">
                  <For each={instructor.bio}>{(bio) => <li>{bio}</li>}</For>
                </ul>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
