import { request } from './client'
import { USE_MOCK } from './mock'
import type { CreateEntryRequest, EntryKind, TranscriptionDraft } from './types'

/** 녹음 파일을 보내고, AI가 받아 적은 글 초안을 받는다 */
export function transcribe(photoId: string, token: string, audio: Blob, kind: EntryKind = 'FIRST') {
  if (USE_MOCK) {
    return new Promise<TranscriptionDraft>((resolve) =>
      setTimeout(
        () =>
          resolve({
            transcriptionId: 'mock-transcription',
            audioAssetId: 'mock-audio',
            transcript: '사진을 찍던 지수가 자꾸 웃어서 우리도 덩달아 웃었던 게 생각나요.',
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          }),
        1200,
      ),
    )
  }
  const form = new FormData()
  form.append('file', audio, `voice.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  form.append('kind', kind)
  return request<TranscriptionDraft>(`/photos/${photoId}/transcriptions`, { method: 'POST', body: form, token })
}

/** 받아 적은 글(또는 직접 쓴 글)을 확정한다 */
export function createEntry(photoId: string, token: string, entry: CreateEntryRequest) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/photos/${photoId}/entries`, { method: 'POST', body: entry, token, idempotent: true })
}

/** 첫 한마디 없이 사진만 먼저 공개한다 ("나중에") */
export function skipFirstEntry(photoId: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/photos/${photoId}/first-entry/skip`, { method: 'POST', token, idempotent: true })
}
