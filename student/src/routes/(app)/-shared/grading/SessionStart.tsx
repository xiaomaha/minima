import { createEffect, createSignal, type JSX, Show } from 'solid-js'
import { OTP_VERIFICATION_EXPIRY_SECONDS } from '@/config'
import { ContentViewer } from '@/shared/ContentViewer'
import { SubmitButton } from '@/shared/SubmitButton'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'
import { OtpVerification } from '../OtpVerification'

interface Props {
  sessionKind: 'exam' | 'assignment' | 'discussion' | 'course' | 'program'
  codeTitle: string
  thumbnail?: string | null
  code: string
  otpToken?: string
  started: boolean
  children?: JSX.Element
  onSubmit: () => Promise<void>
  onTimeout: () => void
}

export const SessionStart = (props: Props) => {
  const { t } = useTranslation()

  const [isPending, setIsPending] = createSignal(false)
  const [honorCodeAgreed, setHonorCodeAgreed] = createSignal(false)
  const [otpVerified, setOtpVerified] = createSignal(false)

  const onSubmit = async (e: Event) => {
    e.preventDefault()
    setIsPending(true)
    await props.onSubmit().finally(() => setIsPending(false))
  }

  createEffect(() => {
    if (props.started || !props.otpToken) return
    // otp session timeout
    const timer = setTimeout(
      () => {
        props.onTimeout()
        setOtpVerified(false)
      },
      OTP_VERIFICATION_EXPIRY_SECONDS * 1000 * 0.8,
    )
    return () => clearTimeout(timer)
  })

  return (
    <div class="max-w-lg mx-auto space-y-6">
      <Show when={props.thumbnail}>
        <img
          class="border border-base-content/10 max-w-xs mx-auto my-8 object-cover aspect-video w-full rounded-lg"
          src={props.thumbnail!}
          alt={t('Thumbnail')}
        />
      </Show>

      <Show
        when={!props.started}
        fallback={
          <div class="text-sm text-center text-gray-500">
            {t('Your {{kind}} session already started.', { kind: t(capitalize(props.sessionKind)) })}
          </div>
        }
      >
        <div class="text-sm text-primary text-center">
          {t('You can start the {{kind}} after agreeing to the honor code.', {
            kind: t(capitalize(props.sessionKind)),
          })}
        </div>
      </Show>

      <div>{props.children}</div>

      <form class="space-y-8" onsubmit={onSubmit}>
        <fieldset class="fieldset w-full bg-base-100 border-base-300 rounded-box border p-4">
          <legend class="fieldset-legend">{props.codeTitle}</legend>

          <ContentViewer
            content={props.code}
            class="h-24 p-3 border border-gray-300 rounded resize overflow-auto leading-normal"
          />

          <label class="label mt-4 text-sm">
            <input
              type="checkbox"
              class="toggle"
              checked={honorCodeAgreed() || props.started}
              onChange={(e) => setHonorCodeAgreed(e.currentTarget.checked)}
              disabled={props.started}
            />
            {t('I have read and agree to the this honor code.')}
          </label>
        </fieldset>

        <Show when={props.otpToken} keyed>
          <OtpVerification
            token={props.otpToken!}
            onVerified={() => setOtpVerified(true)}
            disabled={!honorCodeAgreed() || props.started}
          />
        </Show>

        <SubmitButton
          label={t('Get Started {{sessionKind}}', { sessionKind: t(capitalize(props.sessionKind)) })}
          isPending={isPending()}
          disabled={!honorCodeAgreed() || (!!props.otpToken && !otpVerified()) || props.started}
          class="btn btn-primary w-full"
        />
      </form>
    </div>
  )
}
