import { createSignal, Show } from 'solid-js'
import { accountV1VerifyOtp } from '@/api'
import { OtpSetup } from '@/routes/(app)/account/-profile/OtpSetup'
import { accountStore } from '@/routes/(app)/account/-store'
import { PinInput } from '@/shared/PinInput'
import { useTranslation } from '@/shared/solid/i18n'
import { generateFingerprint } from '@/shared/utils'

export const OtpVerification = (props: { token: string; disabled?: boolean; onVerified: () => void }) => {
  const { t } = useTranslation()
  const [value, setValue] = createSignal('')
  const [verified, setVerified] = createSignal(false)

  const verifyOtp = async (code: string) => {
    const { error } = await accountV1VerifyOtp({
      body: { token: props.token, code, fingerprint: await generateFingerprint() },
      throwOnError: false,
    })
    if (error) {
      setVerified(false)
      setValue('')
      return
    }
    setVerified(true)
    props.onVerified()
  }

  return (
    <Show when={accountStore.user?.otpEnabled} fallback={<OtpSetup />}>
      <div class="space-y-4">
        <div class="text-sm text-neutral-400 text-center">
          <Show when={verified()} fallback={t('Enter the 6-digit code from your authenticator app.')}>
            <span class="text-success">{t('Verification successful')}</span>
          </Show>
        </div>
        <PinInput
          length={6}
          value={value()}
          onChange={(v) => setValue(v)}
          onComplete={verifyOtp}
          disabled={verified() || props.disabled}
        />
      </div>
    </Show>
  )
}
