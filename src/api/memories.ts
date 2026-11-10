import { request } from './client'
import type { CirculationResponse, Job, Scroll, TranscriptionDraft } from './types'

/** Fetch a single server page; the list decides when to request the next cursor. */
export async function getCirculationPage(roomId: string, token: string, cursor?: string, size = 6): Promise<CirculationResponse> {
  const query = new URLSearchParams({ size: String(size) })
  if (cursor) query.set('cursor', cursor)
  return request<CirculationResponse>(`/rooms/${roomId}/circulation?${query}`, { token })
}

/** Used where the complete room is needed, including a deep link to a particular photo. */
export async function getCirculation(roomId: string, token: string) {
  const cards: CirculationResponse['cards'] = []
  let cursor: string | undefined
  const seen = new Set<string>()
  do {
    const page = await getCirculationPage(roomId, token, cursor, 50)
    cards.push(...page.cards)
    cursor = page.nextCursor ?? undefined
    if (cursor && seen.has(cursor)) throw new Error('사진 목록을 이어서 불러오지 못했어요. 다시 시도해 주세요.')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return cards
}

export function passPhoto(photoId: string, token: string) {
  return request(`/photos/${photoId}/passes/me`, { method: 'PUT', token })
}

export function undoPass(photoId: string, token: string) {
  return request(`/photos/${photoId}/passes/me`, { method: 'DELETE', token })
}

export function getScroll(roomId: string, token: string) {
  return request<Scroll>(`/rooms/${roomId}/scroll`, { token })
}

export function getJob(jobId: string, token: string) {
  return request<Job>(`/jobs/${jobId}`, { token })
}

export function retryWeave(roomId: string, token: string) {
  return request<{ job: Job }>(`/rooms/${roomId}/weave-jobs`, { method: 'POST', token, idempotent: true })
}

/** 삭제 후 서버가 문단을 복구/재엮는 작업이 끝날 때까지 job을 확인해야 한다. */
export function deleteReply(replyId: string) {
  return request<{ job: Job }>(`/replies/${replyId}`, { method: 'DELETE' })
}

export function createReply(paragraphId: string, token: string, body: { inputMode: 'TEXT' | 'VOICE'; transcript: string; transcriptionId?: string }) {
  return request<{ job: Job }>(`/paragraphs/${paragraphId}/replies`, { method: 'POST', body, token, idempotent: true })
}

export function transcribeReply(paragraphId: string, token: string, audio: Blob) {
  const form = new FormData()
  form.append('file', audio, `voice.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  return request<TranscriptionDraft>(`/paragraphs/${paragraphId}/transcriptions`, { method: 'POST', body: form, token, idempotent: true })
}

export function setAhMatda(paragraphId: string, token: string, active: boolean) {
  return request(`/paragraphs/${paragraphId}/reactions/ah-matda`, { method: active ? 'PUT' : 'DELETE', token })
}

export function rateParagraph(paragraphId: string, token: string, score: number) {
  return request(`/paragraphs/${paragraphId}/fidelity-rating`, { method: 'PUT', body: { score }, token })
}
