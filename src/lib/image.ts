import type { PhotoContentType } from '../api/types'

/** 서버가 받는 사진 한 장 최대 크기 */
export const MAX_PHOTO_BYTES = 2_000_000
const MAX_EDGE = 2048

const ACCEPTED_TYPES: PhotoContentType[] = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']

export function isAcceptedType(type: string): type is PhotoContentType {
  return (ACCEPTED_TYPES as string[]).includes(type)
}

/**
 * 2MB를 넘는 JPEG·PNG는 브라우저에서 줄여 JPEG로 다시 만든다.
 * HEIC는 대부분의 브라우저가 그릴 수 없어 그대로 보내고, 2MB를 넘으면 실패로 처리한다.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; contentType: PhotoContentType }> {
  const type = file.type as PhotoContentType
  if (file.size <= MAX_PHOTO_BYTES) return { blob: file, contentType: type }
  if (type === 'image/heic' || type === 'image/heif') throw new Error('HEIC 사진은 2MB 이하만 올릴 수 있어요')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // 2MB 이하가 될 때까지 화질을 낮춘다
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= MAX_PHOTO_BYTES) return { blob, contentType: 'image/jpeg' }
  }
  throw new Error('사진 용량이 너무 커요')
}
