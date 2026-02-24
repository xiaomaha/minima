export const resizeContainImage = async (
  file: File,
  targetWidth: number,
  targetHeight: number,
  bgColor = 'transparent',
  quality = 0.9,
) => {
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
