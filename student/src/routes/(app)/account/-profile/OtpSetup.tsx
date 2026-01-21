import { IconAlertCircle, IconCheck, IconDownload, IconInfoCircle } from '@tabler/icons-solidjs'
import type { TOptions } from 'i18next'
import { createEffect, createResource, createSignal, For, Match, Show, Switch } from 'solid-js'
import { createStore } from 'solid-js/store'
import { accountV1CompleteOtpSetup, accountV1ResetOtp, accountV1SetupOtp, type OtpSetupSchema } from '@/api'
import { store as accountStore, setStore as setAccountStore } from '@/routes/(app)/account/-store'
import { Dialog } from '@/shared/Diaglog'
import { PinInput } from '@/shared/PinInput'
import { useTranslation } from '@/shared/solid/i18n'
import { forceDownload, generateFingerprint } from '@/shared/utils'

export const OtpSetup = () => {
  const { t } = useTranslation()

  const [state, setState] = createStore({ isOpen: false, step: 0, pin: '' })

  const [setupTrigger, setSetupTrigger] = createSignal<boolean>()
  const [setupData] = createResource(setupTrigger, async () => {
    const { data } = await accountV1SetupOtp({ throwOnError: true })
    setState('isOpen', true)
    return data
  })

  const [completeCode, setCompleteCode] = createSignal<string>()
  const [completeData] = createResource(completeCode, async () => {
    const { data, error } = await accountV1CompleteOtpSetup({
      body: { code: completeCode()!, fingerprint: await generateFingerprint() },
      throwOnError: false,
    })
    if (error) setState('pin', '')
    else setState('step', 2)
    return data
  })

  const [resetTrigger, setResetTrigger] = createSignal<boolean>()
  const [resetData] = createResource(resetTrigger, async () => {
    await accountV1ResetOtp({ throwOnError: true })
    setAccountStore('user', 'otpEnabled', null)
  })

  const startSetup = async () => {
    setSetupTrigger(true)
  }

  const completeSetup = async (code: string) => {
    setCompleteCode(code)
  }

  const resetOtp = async () => {
    setResetTrigger(true)
  }

  const downloadBackupCodes = () => {
    const backupCodes = setupData()?.backupCodes
    if (!backupCodes) return
    forceDownload(backupCodes.join('\n'), 'text/plain', 'backup-codes.txt')
  }

  createEffect(() => {
    if (!state.isOpen) {
      const data = completeData()
      if (!data) return
      setAccountStore('user', 'otpEnabled', data.createdAt)
    }
  })

  return (
    <>
      <Show
        when={!accountStore.user?.otpEnabled}
        fallback={
          <div class="alert">
            <IconInfoCircle />
            <div class="flex-1">
              <div class="text-sm">{t('You have setup OTP')}</div>
            </div>
            <button type="button" class="btn btn-sm" onClick={resetOtp} disabled={resetData.loading}>
              <Show when={resetData.loading} fallback={t('Reset')}>
                <span class="loading loading-spinner loading-sm" />
              </Show>
            </button>
          </div>
        }
      >
        <div class="alert alert-warning">
          <IconAlertCircle />
          <div class="flex-1">
            <h3 class="font-bold mb-2">{t('Set up OTP')}</h3>
            <div class="text-sm">{t('You need to set up OTP to access restricted content.')}</div>
          </div>
          <button type="button" class="btn btn-sm min-w-18" onClick={startSetup} disabled={setupData.loading}>
            <Show when={setupData.loading} fallback={t('Set up')}>
              <span class="loading loading-spinner loading-sm"></span>
            </Show>
          </button>
        </div>
      </Show>

      <Dialog
        boxClass="max-w-2xl"
        open={state.isOpen}
        onClose={() => {
          setState({ isOpen: false, step: 0, pin: '' })
          setSetupTrigger(undefined)
        }}
      >
        <div class="p-4 px-8">
          <h3 class="mb-8">{t('Setup OTP Authentication')}</h3>

          <Show when={setupData()}>
            <ul class="steps w-full mb-12">
              <li class={`text-sm label step ${state.step >= 0 ? 'step-info' : ''}`}>{t('Install App')}</li>
              <li class={`text-sm label step ${state.step >= 1 ? 'step-info' : ''}`}>{t('Scan QR Code')}</li>
              <li class={`text-sm label step ${state.step >= 2 ? 'step-info' : ''}`}>{t('Save Backup Codes')}</li>
            </ul>

            <Switch>
              <Match when={state.step === 0}>
                <InstallAppStep onNext={() => setState('step', 1)} t={t} />
              </Match>
              <Match when={state.step === 1}>
                <ScanQrStep
                  setupData={setupData()!}
                  pin={state.pin}
                  onPinChange={(pin) => setState('pin', pin)}
                  onComplete={completeSetup}
                  isCompleting={completeData.loading}
                  t={t}
                />
              </Match>
              <Match when={state.step === 2}>
                <BackupCodesStep backupCodes={setupData()!.backupCodes} onDownload={downloadBackupCodes} />
              </Match>
            </Switch>
          </Show>
        </div>
      </Dialog>
    </>
  )
}

interface InstallAppStepProps {
  onNext: () => void
  t: (key: string, options?: TOptions) => string
}

const InstallAppStep = (props: InstallAppStepProps) => {
  return (
    <div class="space-y-4 pl-4">
      <p class="text-sm">{props.t("Install an authenticator app on your mobile device if you haven't already:")}</p>
      <ul class="space-y-2 list-disc list-inside">
        <li>
          <span>{props.t('Google Authenticator')}</span>
          {' - '}

          <a
            href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
            target="_blank"
            class="link link-primary"
            rel="noopener"
          >
            {props.t('Android')}
          </a>
          {' / '}

          <a
            href="https://apps.apple.com/app/google-authenticator/id388497605"
            target="_blank"
            class="link link-primary"
            rel="noopener"
          >
            {props.t('iOS')}
          </a>
        </li>
        <li>
          <span>{props.t('Microsoft Authenticator')}</span>
          {' - '}

          <a
            href="https://play.google.com/store/apps/details?id=com.azure.authenticator"
            target="_blank"
            class="link link-primary"
            rel="noopener"
          >
            {props.t('Android')}
          </a>
          {' / '}

          <a
            href="https://apps.apple.com/us/app/microsoft-authenticator/id983156458"
            target="_blank"
            class="link link-primary"
            rel="noopener"
          >
            {props.t('iOS')}
          </a>
        </li>
        <li>
          <span>{props.t('Apple Authenticator')}</span>
          {' - '}

          <a
            href="https://apps.apple.com/kr/app/authenticator-app-2fa/id6470149516"
            target="_blank"
            class="link link-primary"
            rel="noopener"
          >
            {props.t('iOS')}
          </a>
        </li>
      </ul>
      <div class="flex justify-end mt-8">
        <button type="button" class="btn btn-primary min-w-32" onClick={props.onNext}>
          {props.t('Next')}
        </button>
      </div>
    </div>
  )
}

const ScanQrStep = (props: {
  setupData: OtpSetupSchema
  pin: string
  onPinChange: (pin: string) => void
  onComplete: (code: string) => void
  isCompleting: boolean
  t: (key: string, options?: TOptions) => string
}) => {
  return (
    <div class="space-y-6 flex flex-col items-center mb-8">
      <p class="text-sm text-center">
        {props.t('Scan the QR code below with your authenticator app, then enter the 6-digit code it generates.')}
      </p>
      <div class="card bg-base-200 shadow-md p-4">
        <img src={props.setupData.qrCode} alt="QR Code" class="w-52 h-52 mx-auto mb-2" />
        <div class="text-xs font-mono text-center bg-base-300 p-2 rounded">{props.setupData.secretKey}</div>
      </div>
      <PinInput
        length={6}
        value={props.pin}
        onChange={props.onPinChange}
        onComplete={props.onComplete}
        disabled={props.isCompleting}
      />
    </div>
  )
}

const BackupCodesStep = (props: { backupCodes: string[]; onDownload: () => void }) => {
  const { t } = useTranslation()
  return (
    <div class="space-y-6">
      <div class="alert alert-success">
        <IconCheck />
        <span>{t('Otp Setup Completed Successfully')}</span>
      </div>
      <p class="text-sm">
        {t(
          'Save these codes in a secure location. Each code can be used once if you lose access to your authenticator app.',
        )}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <For each={props.backupCodes}>
          {(code) => <div class="text-center text-sm font-mono bg-base-200 p-3 rounded">{code}</div>}
        </For>
      </div>
      <div class="flex justify-between items-center mt-6">
        <button type="button" class="btn btn-ghost btn-sm gap-2" onClick={props.onDownload}>
          <IconDownload />
          {t('Download backup codes')}
        </button>
      </div>
    </div>
  )
}
