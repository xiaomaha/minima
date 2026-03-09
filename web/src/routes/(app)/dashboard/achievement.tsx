import { IconCertificate } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { onCleanup, onMount, Show } from 'solid-js'
import { competencyV1GetCertificateAwards } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { useTranslation } from '@/shared/solid/i18n'
import { CertificateAwardList } from '../-shared/CertificateAwardList'
import { useDashboard } from './-context'

export const Route = createFileRoute('/(app)/dashboard/achievement')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const { setRefreshHandler } = useDashboard()

  const [certificates, setObserverEl, { refetch }] = createCachedInfiniteStore(
    'competencyV1GetCertificateAwards',
    () => ({}),
    async (options, page) => (await competencyV1GetCertificateAwards({ ...options, query: { page } })).data,
  )

  onMount(() => setRefreshHandler(() => refetch))
  onCleanup(() => setRefreshHandler(undefined))

  return (
    <div class="max-w-5xl mx-auto space-y-8 flex flex-col">
      <div class="label text-sm">{t('Certificates')}</div>

      <CertificateAwardList awards={certificates.items} />

      <Show when={certificates.end && certificates.count === 0}>
        <NoContent icon={IconCertificate} message={t('No certificate awarded yet.')} />
      </Show>

      <Show when={!certificates.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>
    </div>
  )
}
