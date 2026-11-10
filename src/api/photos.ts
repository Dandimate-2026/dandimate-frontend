import { ApiError, devProxyUrl, request } from './client'
import type { UploadFileRequest, UploadTicket } from './types'

/** 한 사람이 올릴 수 있는 사진 수 */
export const MAX_PHOTOS = 3

/**
 * 사진 업로드는 3단계다.
 * 1. 업로드 주소 발급 → 2. 받은 주소로 파일 PUT → 3. 업로드 완료 알림
 * 올린 사진의 id를 고른 순서대로 돌려준다.
 */
export async function uploadPhotos(
  roomId: string,
  token: string,
  files: { request: UploadFileRequest; blob: Blob }[],
  isCancelled: () => boolean = () => false,
): Promise<string[]> {
  const { uploads } = await request<{ uploads: UploadTicket[] }>(`/rooms/${roomId}/photos/upload-requests`, {
    method: 'POST',
    body: { files: files.map((f) => f.request) },
    token,
    idempotent: true,
  })

  const results = await Promise.allSettled(
    uploads.map(async (ticket) => {
      const file = files.find((f) => f.request.clientFileId === ticket.clientFileId)
      if (!file) throw new Error('사진 업로드 정보를 확인하지 못했어요')
      // uploadUrl에 권한이 담겨 있어 Authorization 헤더는 보내지 않는다
      const res = await fetch(devProxyUrl(ticket.uploadUrl), {
        method: 'PUT',
        headers: ticket.requiredHeaders ?? { 'Content-Type': file.request.contentType },
        body: file.blob,
      })
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', '사진을 올리지 못했어요')
      const started = Date.now()
      let status: string | undefined
      do {
        if (isCancelled()) throw new Error('사진 작성을 취소했어요')
        const result = await request<{ photo?: { status?: string } }>(`/photos/${ticket.photoId}/complete`, { method: 'POST', token, idempotent: true })
        status = result?.photo?.status
        if (status === 'FAILED') throw new Error('사진을 처리하지 못했어요. 다른 사진을 선택해 주세요')
        if (status === 'READY') break
        if (status !== 'PROCESSING' && status !== 'UPLOADING') throw new Error('사진 처리 상태를 확인하지 못했어요. 다시 시도해 주세요')
        if (Date.now() - started >= 60000) throw new Error('사진 처리가 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요')
        await new Promise(resolve => window.setTimeout(resolve, 1000))
      } while (status === 'PROCESSING' || status === 'UPLOADING')
    }),
  )
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    await Promise.allSettled(uploads.map((ticket) => deletePhoto(ticket.photoId)))
    throw failure.reason
  }
  return files.map((f) => uploads.find((u) => u.clientFileId === f.request.clientFileId)?.photoId ?? '')
}

/** 내가 올린 사진을 지운다 (한마디를 남기기 전에 사진 올리기를 그만둘 때) */
export function deletePhoto(photoId: string) {
  return request<void>(`/photos/${photoId}`, { method: 'DELETE' })
}
