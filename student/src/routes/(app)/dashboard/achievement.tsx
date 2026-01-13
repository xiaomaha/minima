import { useTransContext } from '@mbarzda/solid-i18next'
import { IconRefresh } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { competencyV1GetCertificateAwards } from '@/api'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { CertificateAwardList } from '../-shared/CertificateAwardList'

export const Route = createFileRoute('/(app)/dashboard/achievement')({
  component: RouteComponent,
})

function RouteComponent() {
  const [t] = useTransContext()

  const [certificates, setObserverEl, { refetch }] = createCachedInfiniteStore(
    'competencyV1GetCertificateAwards',
    () => ({}),
    async (options, page) => {
      const { data } = await competencyV1GetCertificateAwards({ ...options, query: { page } })
      return data
    },
  )

  return (
    <div class="max-w-5xl mx-auto space-y-8 flex flex-col">
      <div class="label text-sm flex items-start justify-between">
        {t('Certificates')}
        <button type="button" class="btn btn-sm btn-ghost btn-circle" onClick={refetch}>
          <IconRefresh size={20} />
        </button>
      </div>

      <CertificateAwardList awards={certificates.items} />

      <Show when={!certificates.end}>
        <div ref={setObserverEl} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>
    </div>
  )
}
