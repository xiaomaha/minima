import type { CropperSelection } from 'cropperjs'
import { createEffect, createSignal, on, onMount } from 'solid-js'
import { Dialog } from '@/shared/Diaglog'
import { useTranslation } from '@/shared/solid/i18n'
import { resizeContainImage } from './resizeContainImage'

interface Props {
  file: File | undefined
  aspectRatio?: number
  onClose: () => void
  onCrop: (blob: Blob, originalFile: File) => void
}

export const ImageCropDialog = (props: Props) => {
  const { t } = useTranslation()

  let cropperSelectionRef: CropperSelection | undefined

  const [imageUrl, setImageUrl] = createSignal('')
  const isReady = () => !!props.file && !!imageUrl()

  onMount(async () => {
    await import('cropperjs')
  })

  createEffect(
    on(
      () => props.file,
      async (currentFile) => {
        setImageUrl('')
        if (!currentFile) return

        const img = new Image()
        const objectUrl = URL.createObjectURL(currentFile)
        img.src = objectUrl

        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
        })

        const { url } = await resizeContainImage(currentFile, 400, 400 / (props.aspectRatio ?? 1))
        setImageUrl(url)

        URL.revokeObjectURL(objectUrl)
      },
    ),
  )

  const handleSave = async () => {
    const currentFile = props.file
    if (!currentFile || !cropperSelectionRef) return

    const canvas = await cropperSelectionRef.$toCanvas()
    if (!canvas) return

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, currentFile.type))
    if (!blob) return

    props.onCrop(blob, currentFile)
  }

  return (
    <Dialog title={t('Crop image')} boxClass="w-auto" open={isReady()} onClose={props.onClose}>
      <div class="p-4 bg-base-content/70">
        <cropper-canvas background style={{ width: '400px', height: `${400 / (props.aspectRatio ?? 1)}px` }}>
          <cropper-image src={imageUrl()} alt="Crop target" />
          <cropper-shade hidden />
          <cropper-handle action="select" plain />
          <cropper-selection
            ref={cropperSelectionRef}
            initial-coverage="1"
            attr:aspect-ratio={props.aspectRatio ?? '1'}
            movable
            resizable
          >
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

      <div class="p-4 text-right">
        <button type="button" class="btn btn-primary " onClick={handleSave}>
          {t('Save')}
        </button>
      </div>
    </Dialog>
  )
}
