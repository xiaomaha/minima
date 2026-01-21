import type { CropperSelection } from 'cropperjs'
import { createEffect, createSignal, on, onMount, Show } from 'solid-js'
import { accountV1UploadAvatar } from '@/api'
import { AVATAR_MAX_SIZE } from '@/config'
import { store as accountStore, setStore as setAccountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { Dialog } from '@/shared/Diaglog'
import { useTranslation } from '@/shared/solid/i18n'

export const AvatarEdit = () => {
  const { t } = useTranslation()

  const [file, setFile] = createSignal<File | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [imageUrl, setImageUrl] = createSignal<string>('')
  const [isUploading, setIsUploading] = createSignal(false)

  let fileInputRef: HTMLInputElement | undefined
  let cropperSelectionRef: CropperSelection | undefined

  const isReady = () => !!file() && !!imageUrl()

  onMount(async () => {
    await import('cropperjs')
  })

  createEffect(
    on(file, async (currentFile) => {
      setImageUrl('')

      if (!currentFile) return

      const img = new Image()
      const objectUrl = URL.createObjectURL(currentFile)
      img.src = objectUrl

      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
      })

      const { url } = await resizeContainImage(currentFile, 400, 400)
      setImageUrl(url)

      URL.revokeObjectURL(objectUrl)

      if (cropperSelectionRef) {
        const scale = Math.min(400 / img.width, 400 / img.height)
        const size = Math.min(400, Math.min(img.width, img.height) * scale)
        const offset = (400 - size) / 2

        requestAnimationFrame(() => {
          cropperSelectionRef?.$change(offset, offset, size, size)
        })
      }
    }),
  )

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const selectedFile = target.files?.[0] || null
    setError(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    if (selectedFile.size > AVATAR_MAX_SIZE) {
      setError(t('File size must be less than 5MB'))
      return
    }

    setFile(selectedFile)
    target.value = ''
  }

  const onSuccess = (url: string | null) => {
    setAccountStore('user', 'avatar', url)
    setFile(null)
    setError(null)
    setIsUploading(false)
  }

  const saveAvatar = async (e: Event) => {
    setIsUploading(true)

    e.preventDefault()
    const currentFile = file()

    if (!currentFile) {
      await accountV1UploadAvatar({ body: { avatarFile: null } })
      onSuccess(null)
      return
    }

    if (!cropperSelectionRef) return

    const canvas = await cropperSelectionRef.$toCanvas()
    if (!canvas) return

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, currentFile.type))
    if (!blob) return

    const { data } = await accountV1UploadAvatar({
      body: { avatarFile: new File([blob], currentFile.name, { type: currentFile.type }) },
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
      <Dialog title={t('Edit avatar')} boxClass="w-auto" open={isReady()} onClose={() => setFile(null)}>
        <div class="w-100 h-100">
          <cropper-canvas style={{ width: '400px', height: '400px' }} background>
            <cropper-image src={imageUrl()} alt="Avatar" />
            <cropper-shade hidden />
            <cropper-handle action="select" plain />
            <cropper-selection ref={cropperSelectionRef} initial-coverage="0.9" aspect-ratio="1" movable resizable>
              <cropper-grid bordered covered />
              <cropper-crosshair centered />
              <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)" />
              <cropper-handle action="n-resize" />
              <cropper-handle action="e-resize" />
              <cropper-handle action="s-resize" />
              <cropper-handle action="w-resize" />
              <cropper-handle action="ne-resize" />
              <cropper-handle action="nw-resize" />
              <cropper-handle action="se-resize" />
              <cropper-handle action="sw-resize" />
            </cropper-selection>
          </cropper-canvas>
        </div>

        <div class="modal-action">
          <button type="button" class="btn btn-primary mr-4 mb-4" onClick={saveAvatar} disabled={isUploading()}>
            <Show when={isUploading()} fallback={t('Save')}>
              <span class="loading loading-spinner" />
            </Show>
          </button>
        </div>
      </Dialog>

      <div class="relative inline-block">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} class="hidden" />

        <button type="button" class="cursor-pointer" onClick={() => fileInputRef?.click()}>
          <Avatar user={accountStore.user!} size="3xl" />
        </button>

        <Show when={accountStore.user?.avatar}>
          <button
            type="button"
            class="absolute right-0 bottom-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(t('Are you sure you want to delete your avatar?'))) {
                deleteAvatar()
              }
            }}
          >
            ✕
          </button>
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

async function resizeContainImage(
  file: File,
  targetWidth: number,
  targetHeight: number,
  bgColor = 'transparent',
  quality = 0.9,
) {
  return new Promise<{ blob: Blob; url: string }>((resolve, reject) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = targetWidth
      canvas.height = targetHeight

      const scale = Math.min(targetWidth / img.width, targetHeight / img.height)
      const newWidth = img.width * scale
      const newHeight = img.height * scale

      const x = (targetWidth - newWidth) / 2
      const y = (targetHeight - newHeight) / 2

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, targetWidth, targetHeight)
      } else {
        ctx.clearRect(0, 0, targetWidth, targetHeight)
      }

      ctx.drawImage(img, x, y, newWidth, newHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Blob creation failed'))
          const url = URL.createObjectURL(blob)
          resolve({ blob, url })
        },
        'image/png',
        quality,
      )
    }

    img.onerror = reject
  })
}
