import { useNavigate } from '@tanstack/solid-router'
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
    'courseV1GetDetail',
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
          <div class="flex flex-col gap-12 prose max-w-none">
            <div class="w-full max-w-4xl mx-auto aspect-video rounded-lg overflow-hidden">
              <VideoPlayer src={detail.previewUrl || COURSE_PREVIEW_FALLBACK_URL} />
            </div>

            <div>
              <h3 class="text-2xl font-bold mb-4">
                <span class="font-semibold mr-3">{t('FAQ')}.</span>
                <span>{detail.faq.name}</span>
              </h3>
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

            <div>
              <h3 class="text-2xl font-bold mb-4">{t('Related Courses')}</h3>
              <RelatedCourses course={detail} />
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

      <Show when={props.course.courseCategories.length > 0}>
        <div class="flex flex-col">
          <div class="font-semibold">{t('Categories')}</div>
          <ul class="list-disc">
            <For each={props.course.courseCategories}>
              {(category) => <li class="mt-0 py-1">{`${category.label}`}</li>}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}

const Certificate = (props: { course: CourseDetailSchema }) => {
  const { t } = useTranslation()
  const certificates = () => props.course.courseCertificates

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
                      src={certificate.certificate.thumbnail}
                      class="w-full h-full object-cover rounded-md border border-gray-300"
                      alt={certificate.label}
                    />
                  </div>
                </div>
                <div class="flex flex-col gap-1 mt-4">
                  <h4 class="text-xl font-bold">{certificate.label}</h4>
                  <p class="text-sm">{certificate.certificate.description}</p>
                  <div class="flex gap-2 items-center mt-4">
                    <div class="avatar avatar-placeholder">
                      <div class="w-10 rounded-full bg-base-300">
                        <Show
                          when={certificate.certificate.issuer.logo}
                          fallback={<span class="text-xl">{certificate.certificate.issuer.name[0]}</span>}
                        >
                          <img src={certificate.certificate.issuer.logo!} alt={certificate.certificate.issuer.name} />
                        </Show>
                      </div>
                    </div>
                    <div class="text-lg font-semibold">{certificate.certificate.issuer.name}</div>
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
  const questions = () => props.course.faq.items
  const [openId, setOpenId] = createSignal<number | null>(0)

  return (
    <div class="join join-vertical bg-base-100 w-full">
      <For each={questions()}>
        {(question, i) => (
          <div class="collapse collapse-arrow join-item border-base-300 border">
            <input
              type="checkbox"
              checked={openId() === i()}
              onChange={() => setOpenId(openId() === i() ? null : i())}
            />
            <div class="collapse-title font-semibold">
              <div class="flex gap-2 items-center">
                <span class="text-sm text-gray-500">{new Date(question.modified).toLocaleDateString()}</span>
                <span class="text-sm" classList={{ 'line-clamp-1': openId() !== i() }}>
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
  const instructors = () => props.course.courseInstructors

  return (
    <Show when={instructors().length > 0} fallback={<p>{t('No instructors are assigned for this course.')}</p>}>
      <div class="flex flex-col gap-6">
        <For each={instructors()}>
          {(instructor) => (
            <div class="flex flex-row gap-6 items-start">
              <Avatar user={{ name: instructor.label, ...instructor.instructor }} size="3xl" class="mt-4" />
              <div class="flex flex-col gap-2">
                <h4 class="text-xl font-bold flex gap-2 items-center">
                  {instructor.label}
                  <Show when={instructor.lead}>
                    <div class="badge badge-outline badge-sm badge-info">{t('Lead')}</div>
                  </Show>
                </h4>
                <p class="text-sm text-gray-500">{instructor.instructor.about}</p>
                <ul class="list-disc list-inside">
                  <For each={instructor.instructor.bio}>{(bio) => <li>{bio}</li>}</For>
                </ul>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}

const RelatedCourses = (props: { course: CourseDetailSchema }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Show when={props.course.courseInstructors.length > 0} fallback={<p>{t('No related courses.')}</p>}>
      <div class="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
        <For each={props.course.courseRelations}>
          {(c) => (
            <div
              class="card w-full space-y-2 cursor-pointer"
              onclick={() => navigate({ to: `/course/${c.id}/session` })}
            >
              <figure>
                <img src={c.relatedCourse.thumbnail!} alt={c.label} class="w-full ratio-video object-cover" />
              </figure>
              <div class="py-2 space-y-3">
                <div class="font-semibold line-clamp-2 text-base/tight">{c.label}</div>
                <p class="line-clamp-3">{c.relatedCourse.description}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
