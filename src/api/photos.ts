import { ApiError, request } from './client'
import { USE_MOCK } from './mock'
import type { UploadFileRequest, UploadTicket } from './types'

/**
 * 사진 업로드는 3단계다.
 * 1. 업로드 주소 발급 → 2. 받은 주소로 파일 PUT → 3. 업로드 완료 알림
 */
export async function uploadPhotos(roomId: string, token: string, files: { request: UploadFileRequest; blob: Blob }[]) {
  if (USE_MOCK) return

  const { uploads } = await request<{ uploads: UploadTicket[] }>(`/rooms/${roomId}/photos/upload-requests`, {
    method: 'POST',
    body: { files: files.map((f) => f.request) },
    token,
    idempotent: true,
  })

  await Promise.all(
    uploads.map(async (ticket) => {
      const file = files.find((f) => f.request.clientFileId === ticket.clientFileId)
      if (!file) return
      // uploadUrl에 권한이 담겨 있어 Authorization 헤더는 보내지 않는다
      const res = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: ticket.requiredHeaders ?? { 'Content-Type': file.request.contentType },
        body: file.blob,
      })
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', '사진을 올리지 못했어요')
      await request(`/photos/${ticket.photoId}/complete`, { method: 'POST', token, idempotent: true })
    }),
  )
}
