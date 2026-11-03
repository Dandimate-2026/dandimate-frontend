import { request } from './client'
import { mockTranscribe, USE_MOCK } from './mock'
import type { CirculationResponse, Entry, Job, Member, Scroll, TranscriptionDraft } from './types'
import { MEMORY_PHOTOS } from '../features/memories/data'

const mockStatuses = new Map<string, 'ADDON' | 'PASSED'>()
const mockReactionCounts = new Map<string, number>()
const mockReplyCounts = new Map<string, number>()
const mockMember: Member = { id: 'mock-member', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA' }

function mockPhotoCards(): CirculationResponse['cards'] {
  return MEMORY_PHOTOS.slice(0, 2).map((item) => {
    const uploader: Member = { id: `owner-${item.id}`, nickname: item.owner, role: 'MEMBER', flowerCode: item.flower === 'blue' ? 'FORGET_ME_NOT' : 'AZALEA' }
    const photo = { id: item.id, imageUrl: item.photoUrl ?? '', uploader, displayOrder: 1 }
    const entry = (id: string, author: Member, transcript: string): Entry => ({ id, photoId: item.id, member: author, kind: 'FIRST', inputMode: 'TEXT', transcript, confirmedAt: new Date().toISOString() })
    const status = mockStatuses.get(item.id) ?? 'NONE'
    return {
      photo,
      firstEntry: entry(`first-${item.id}`, uploader, item.firstStory.text),
      myResponse: { status },
      locked: status === 'NONE',
      lockReason: status === 'NONE' ? 'RESPOND_FIRST' as const : null,
      otherEntries: status === 'NONE' ? [] : item.friends.map((friend, index) => entry(`friend-${item.id}-${index}`, { ...mockMember, nickname: friend.author }, friend.text)),
    }
  })
}

export function recordMockAddon(photoId: string) {
  if (USE_MOCK) mockStatuses.set(photoId, 'ADDON')
}

export async function getCirculation(roomId: string, token: string) {
  if (USE_MOCK) return mockPhotoCards()
  const cards: CirculationResponse['cards'] = []
  let cursor: string | null | undefined
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    const page = await request<CirculationResponse>(`/rooms/${roomId}/circulation${query}`, { token })
    cards.push(...page.cards)
    cursor = page.nextCursor
  } while (cursor)
  return cards
}

export function passPhoto(photoId: string, token: string) {
  if (USE_MOCK) { mockStatuses.set(photoId, 'PASSED'); return Promise.resolve() }
  return request(`/photos/${photoId}/passes/me`, { method: 'PUT', token })
}

export function undoPass(photoId: string, token: string) {
  if (USE_MOCK) { mockStatuses.delete(photoId); return Promise.resolve() }
  return request(`/photos/${photoId}/passes/me`, { method: 'DELETE', token })
}

export function getScroll(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve<Scroll>({
    id: 'mock-scroll', version: 1, participantCount: 3, memberCount: 3,
    paragraphs: mockPhotoCards().map((card, index) => ({
      id: `paragraph-${index}`, photo: card.photo, body: MEMORY_PHOTOS[index].firstStory.text,
      version: 1, sources: [{ entryId: `first-${index}`, member: card.photo.uploader, quote: MEMORY_PHOTOS[index].firstStory.text }],
      replyCount: mockReplyCounts.get(`paragraph-${index}`) ?? 0,
      ahMatdaCount: mockReactionCounts.get(`paragraph-${index}`) ?? 0, aiGenerated: true,
    })),
  })
  return request<Scroll>(`/rooms/${roomId}/scroll`, { token })
}

export function getJob(jobId: string, token: string) {
  if (USE_MOCK) return Promise.resolve<Job>({ id: jobId, type: 'WEAVE_SCROLL', status: 'SUCCEEDED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  return request<Job>(`/jobs/${jobId}`, { token })
}

export function retryWeave(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve<{ job: Job }>({ job: { id: 'mock-job', type: 'WEAVE_SCROLL', status: 'QUEUED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  return request<{ job: Job }>(`/rooms/${roomId}/weave-jobs`, { method: 'POST', token, idempotent: true })
}

export function createReply(paragraphId: string, token: string, body: { inputMode: 'TEXT' | 'VOICE'; transcript: string; transcriptionId?: string }) {
  if (USE_MOCK) {
    mockReplyCounts.set(paragraphId, (mockReplyCounts.get(paragraphId) ?? 0) + 1)
    return Promise.resolve<{ job: Job }>({ job: { id: 'mock-reply-job', type: 'REPLY_REWEAVE', status: 'SUCCEEDED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  }
  return request<{ job: Job }>(`/paragraphs/${paragraphId}/replies`, { method: 'POST', body, token, idempotent: true })
}

export function transcribeReply(paragraphId: string, token: string, audio: Blob) {
  if (USE_MOCK) return mockTranscribe('함께 웃었던 그 장면이 아직 기억나요.')
  const form = new FormData()
  form.append('file', audio, `voice.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  return request<TranscriptionDraft>(`/paragraphs/${paragraphId}/transcriptions`, { method: 'POST', body: form, token, idempotent: true })
}

export function setAhMatda(paragraphId: string, token: string, active: boolean) {
  if (USE_MOCK) { mockReactionCounts.set(paragraphId, Math.max(0, (mockReactionCounts.get(paragraphId) ?? 0) + (active ? 1 : -1))); return Promise.resolve() }
  return request(`/paragraphs/${paragraphId}/reactions/ah-matda`, { method: active ? 'PUT' : 'DELETE', token })
}

export function rateParagraph(paragraphId: string, token: string, score: number) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/paragraphs/${paragraphId}/fidelity-rating`, { method: 'PUT', body: { score }, token })
}
