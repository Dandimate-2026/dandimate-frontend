// 모임방 대표 사진: 서버에 올리고 받은 imageUrl을 방 만들기·수정에 보낸다
import { request, SERVER_ORIGIN } from './client'
import { USE_MOCK } from './mock'

export interface CoverPhoto {
  id: string
  /** 서버 주소 기준 경로 (/api/v1/room-covers/{id}/image). 화면에 쓸 땐 coverSrc로 바꾼다 */
  imageUrl: string
}

/** 대표 사진 올리기 (로그인 필요). 방을 만들기 전에도 올릴 수 있다 */
export async function uploadRoomCover(file: Blob, previewDataUrl: string): Promise<CoverPhoto> {
  if (USE_MOCK) return { id: 'mock-cover', imageUrl: previewDataUrl }
  const form = new FormData()
  form.append('file', file, 'cover.jpg')
  return request<CoverPhoto>('/room-covers', { method: 'POST', body: form })
}

/**
 * 서버가 준 대표 사진 주소를 <img>에 쓸 수 있는 주소로 바꾼다.
 * 로컬 개발은 개발 서버 프록시(/api)로, 배포는 서버 주소를 붙인다. 이미 완전한 주소(data:, https:)면 그대로
 */
export function coverSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (!url.startsWith('/')) return url
  return import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL ? url : `${SERVER_ORIGIN}${url}`
}
