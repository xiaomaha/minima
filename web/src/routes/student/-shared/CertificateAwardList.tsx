import { For, Show } from 'solid-js'
import type { CertificateAwardSchema } from '@/api'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  awards: CertificateAwardSchema[]
  class?: string
}

export const CertificateAwardList = (props: Props) => {
  const { t } = useTranslation()

  return (
    <div class={`${props.class ?? ''}`}>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 max-w-7xl mx-auto">
        <For each={props.awards}>
          {(cert) => (
            <div>
              <a
                href={cert.pdf}
                target="_blank"
                rel="noreferrer"
                class="relative block h-100 rounded-2xl overflow-hidden shadow-md hover:scale-101 transition-transform"
              >
                <div
                  class="absolute inset-0 bg-cover bg-center blur-xl scale-110"
                  style={`background-image: url(${cert.thumbnail}); filter: brightness(0.4)`}
                />
                <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                <div class="relative w-full h-full p-4 flex items-center justify-center">
                  <img
                    src={cert.thumbnail}
                    alt={`certificate-${cert.id}`}
                    class="max-w-full max-h-full object-contain drop-shadow-2xl"
                  />
                </div>
              </a>
              <div class="my-1 label text-sm text-center block">{new Date(cert.created).toLocaleString()}</div>
            </div>
          )}
        </For>
      </div>
      <Show when={props.awards.length}>
        <div class="text-center mt-8 text-primary">
          {t('Congratulations! You have earned {{count}} certificate', { count: props.awards.length })}
        </div>
      </Show>
    </div>
  )
}
