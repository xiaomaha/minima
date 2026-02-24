import { IconX } from '@tabler/icons-solidjs'
import { createSignal, Show } from 'solid-js'
import { accountV1UploadAvatar } from '@/api'
import { AVATAR_MAX_SIZE } from '@/config'
import { accountStore, setStore as setAccountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { ImageCropDialog } from '@/shared/image/ImageCropDialog'
import { useTranslation } from '@/shared/solid/i18n'

export const AvatarEdit = () => {
  const { t } = useTranslation()

  const [cropFile, setCropFile] = createSignal<File | undefined>()
  const [error, setError] = createSignal<string | null>(null)
  const [isUploading, setIsUploading] = createSignal(false)

  let fileInputRef: HTMLInputElement | undefined

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const selectedFile = target.files?.[0]
    setError(null)
    target.value = ''

    if (!selectedFile) return

    if (selectedFile.size > AVATAR_MAX_SIZE) {
      setError(t('File size must be less than 5MB'))
      return
    }

    setCropFile(selectedFile)
  }

  const onSuccess = (url: string | null) => {
    setAccountStore('user', 'avatar', url)
    setCropFile(undefined)
    setError(null)
    setIsUploading(false)
  }

  const handleCrop = async (blob: Blob, originalFile: File) => {
    setIsUploading(true)

    const { data } = await accountV1UploadAvatar({
      body: { avatarFile: new File([blob], originalFile.name, { type: originalFile.type }) },
    })

    onSuccess(data)
  }

  const deleteAvatar = async () => {
    setIsUploading(true)
    await accountV1UploadAvatar({ body: { avatarFile: null }, throwOnError: true })
    onSuccess(null)
  }

  return (
    <Show when={accountStore.user}>
      <ImageCropDialog file={cropFile()} aspectRatio={1} onClose={() => setCropFile(undefined)} onCrop={handleCrop} />

      <div class="relative inline-block">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} class="hidden" />

        <button type="button" class="cursor-pointer" onClick={() => fileInputRef?.click()}>
          <Avatar user={accountStore.user!} size="3xl" />
        </button>

        <Show when={accountStore.user?.avatar}>
          <Show when={!isUploading()} fallback={<div class="loading loading-xs absolute left-full top-full -m-2" />}>
            <button
              type="button"
              class="absolute left-full top-full -m-2 h-auto w-auto cursor-pointer btn btn-circle btn-ghost btn-xs"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(t('Are you sure you want to delete your avatar?'))) {
                  deleteAvatar()
                }
              }}
            >
              <IconX size={16} />
            </button>
          </Show>
        </Show>

        <Show when={error()}>
          <p class="text-error text-sm absolute" style={{ bottom: '-1.5em', 'white-space': 'nowrap' }}>
            {error()}
          </p>
        </Show>
      </div>
    </Show>
  )
}
