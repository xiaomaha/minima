import { IconCertificate } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import { competencyV1GetCertificates, courseV1RequestCertificate } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { NoContent } from '@/shared/NoContent'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { CertificateAwardList } from '../../-shared/CertificateAwardList'
import { useSession } from './context'

export const Achievement = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  const [certificates] = createCachedStore(
    'competencyV1GetCertificates',
    () => ({ query: { courseId: s().course.id } }),
    async (options) => (await competencyV1GetCertificates(options)).data,
  )

  return (
    <div class="max-w-5xl mx-auto space-y-12">
      <Show when={session.data!.certificateAwards?.length}>
        <CertificateAwardList awards={session.data!.certificateAwards!} />
      </Show>
      <div>
        <div class="font-bold mb-6 text-sm">{t('Course Certificates')}</div>

        <Show when={certificates.data?.length === 0}>
          <NoContent icon={IconCertificate} message={t('This course has no certificates.')} />
        </Show>

        <div class="space-y-6">
          <For each={certificates.data}>
            {(cert) => (
              <div class="card bg-base-100 shadow">
                <div class="card-body">
                  <div class="flex flex-col md:flex-row gap-8">
                    <div class="w-80 shrink-0 mx-auto">
                      <img
                        src={cert.thumbnail}
                        alt={cert.name}
                        class="w-full aspect-[1/1.4] object-cover rounded border border-base-content/10"
                      />
                    </div>

                    <div class="flex-1 space-y-8">
                      <div>
                        <h4 class="text-xl font-bold">{cert.name}</h4>
                        <p class="text-sm/5 text-base-content/60 mt-2">{cert.description}</p>
                      </div>

                      <div class="flex items-center gap-3">
                        <Avatar user={{ avatar: cert.issuer.logo, ...cert.issuer }} />
                        <div>
                          <div class="label text-xs">{t('Issued by')}</div>
                          <div class="font-semibold text-base">{cert.issuer.name}</div>
                        </div>
                      </div>

                      <Show when={cert.certificateSkills.length > 0}>
                        <div class="space-y-4">
                          <div class="text-sm font-semibold divider divider-start after:h-px">{t('Skills')}</div>
                          <For each={cert.certificateSkills}>
                            {(certSkill) => (
                              <div>
                                <div class="breadcrumbs py-0">
                                  <ul class="text-xs label m-0">
                                    <For each={certSkill.skill.classification.ancestors}>
                                      {(ancestor) => <li>{ancestor}</li>}
                                    </For>
                                  </ul>
                                </div>

                                <div class="flex items-center gap-3">
                                  <span class="text-base">{certSkill.skill.name}</span>
                                  <span class="badge badge-xs badge-neutral">
                                    {t('Level {{num}}', { num: certSkill.skill.level })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>

                      <Show when={cert.certificateEndorsements.length > 0}>
                        <div class="space-y-2">
                          <div class="text-sm font-semibold divider divider-start after:h-px">{t('Endorsements')}</div>
                          <div class="grid grid-cols-2 gap-4">
                            <For each={cert.certificateEndorsements}>
                              {(certEndorsement) => (
                                <div class="flex gap-3">
                                  <div class="flex flex-col gap-1">
                                    <div class="text-sm">{certEndorsement.partner.name}</div>
                                    <div class="label text-xs">{certEndorsement.claim}</div>
                                    <div class="label text-xs">
                                      {new Date(certEndorsement.endorsed).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      <CertificateButton certificateId={cert.id} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

interface CertificateButtonProps {
  certificateId: number
}

const CertificateButton = (props: CertificateButtonProps) => {
  const [session, { setStore }] = useSession()
  const { t } = useTranslation()

  const [isPending, setIsPending] = createSignal(false)
  const requestCertificate = async () => {
    setIsPending(true)
    try {
      const { data } = await courseV1RequestCertificate({
        path: { id: session.data!.course.id },
        body: { certificateId: props.certificateId },
      })
      setStore('data', 'certificateAwards', (prev) => (prev ? [data, ...prev] : [data]))
    } finally {
      setIsPending(false)
    }
  }

  const eligible = session.data!.engagement?.gradebook?.certificateEligible
  const awarded = () =>
    (session.data!.certificateAwards?.findIndex((c) => c.certificateId === props.certificateId) ?? -1) > -1

  return (
    <Show when={eligible && !awarded()}>
      <button type="button" class="btn btn-primary w-full" onClick={requestCertificate}>
        <Show when={!isPending()} fallback={<span class="loading loading-spinner"></span>}>
          {t('Request Certificate')}
        </Show>
      </button>
    </Show>
  )
}
