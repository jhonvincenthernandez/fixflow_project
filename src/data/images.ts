import { ValidationError } from '@/domain/errors'
import { logger } from '@/domain/logger'
import type { ImageUpload } from './repo'

const MAX_SIDE = 1280
const JPEG_QUALITY = 0.82

const UNREADABLE = new ValidationError({ images: ['That photo could not be read. Try a different one.'] })

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(UNREADABLE) : resolve(blob)),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/**
 * Downscales a chosen photo to at most 1280 px on its long side and re-encodes it as JPEG.
 * Phone cameras produce 3 to 8 MB files; this keeps the local database small and fast.
 */
export async function prepareImage(file: File): Promise<ImageUpload> {
  if (!file.type.startsWith('image/')) {
    throw new ValidationError({ images: ['Only image files can be attached.'] })
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (error) {
    logger.error('Decoding the chosen photo failed', error, { type: file.type, size: file.size })
    throw UNREADABLE
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (context === null) throw UNREADABLE
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return { name: `${baseName}.jpg`, blob }
  } finally {
    bitmap.close()
  }
}
