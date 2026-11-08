import { request } from './client'
import { asMockRole, consumeMockReweave, MOCK_DONE_ROOM_ID, MOCK_SCROLL_PREVIEW_ROOM_ID, mockDoneRoomHome, mockRoomHome, mockTranscribe, USE_MOCK, MOCK_LIVELY_ROOM_ID, mockLivelyCards, DEMO_CIRCULATION_PHOTOS, getMockRole } from './mock'
import type { CirculationResponse, Entry, Job, Member, Scroll, ScrollReply, TranscriptionDraft } from './types'
import { MEMORY_PHOTOS } from '../features/memories/data'

const mockStatuses = new Map<string, 'ADDON' | 'PASSED'>()
const mockReactionCounts = new Map<string, number>()
const mockReplyCounts = new Map<string, number>()
const mockReplies = new Map<string, ScrollReply[]>()
const mockRewoven = new Map<string, { body: string; version: number; quote: string }>()
const mockJobs = new Map<string, number>()
const mockMember: Member = { id: 'mock-member', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA' }
const mockParagraphId = (roomId: string, index: number) => `${roomId === MOCK_SCROLL_PREVIEW_ROOM_ID ? `${roomId}:` : ''}paragraph-${index}`

function mockPhotoCards(): CirculationResponse['cards'] {
  return DEMO_CIRCULATION_PHOTOS.map((item) => {
    const uploader: Member = { id: `owner-${item.id}`, nickname: item.owner, role: 'MEMBER', flowerCode: item.flower === 'blue' ? 'FORGET_ME_NOT' : 'AZALEA' }
    const photo = { id: item.id, imageUrl: item.photoUrl ?? '', uploader, displayOrder: 1 }
    const entry = (id: string, author: Member, transcript: string): Entry => ({ id, photoId: item.id, member: author, kind: 'FIRST', inputMode: 'TEXT', transcript, confirmedAt: new Date().toISOString() })
    // 데모의 '나': 방장이면 서연, 멤버면 민지 (서버처럼 내가 올린 사진은 OWN_PHOTO)
    const myNickname = getMockRole() === 'MEMBER' ? '민지' : '서연'
    const status = item.owner === myNickname ? 'OWN_PHOTO' as const : mockStatuses.get(item.id) ?? 'NONE'
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
  if (USE_MOCK) return roomId === MOCK_LIVELY_ROOM_ID ? mockLivelyCards() : mockPhotoCards()
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
  const previewHome = asMockRole(roomId === MOCK_DONE_ROOM_ID || roomId === MOCK_SCROLL_PREVIEW_ROOM_ID ? mockDoneRoomHome : mockRoomHome)
  if (USE_MOCK) return Promise.resolve<Scroll>({
    id: 'mock-scroll', version: 1, participantCount: previewHome.members.length, memberCount: previewHome.members.length,
    paragraphs: mockPhotoCards().map((card, index) => ({
      id: mockParagraphId(roomId, index), photo: card.photo, body: mockRewoven.get(mockParagraphId(roomId, index))?.body ?? MEMORY_PHOTOS[index].firstStory.text,
      version: mockRewoven.get(mockParagraphId(roomId, index))?.version ?? 1, sources: [
        { entryId: `first-${index}`, member: card.photo.uploader, quote: MEMORY_PHOTOS[index].firstStory.text },
        ...(mockRewoven.has(mockParagraphId(roomId, index)) ? [{ entryId: `reply-${index}`, member: previewHome.me, quote: mockRewoven.get(mockParagraphId(roomId, index))!.quote }] : []),
      ],
      replyCount: mockReplyCounts.get(mockParagraphId(roomId, index)) ?? 0,
      replies: mockReplies.get(mockParagraphId(roomId, index)) ?? [],
      ahMatdaCount: mockReactionCounts.get(mockParagraphId(roomId, index)) ?? 0, aiGenerated: true,
    })),
  })
  return request<Scroll>(`/rooms/${roomId}/scroll`, { token })
}

export function getJob(jobId: string, token: string) {
  if (USE_MOCK) return Promise.resolve<Job>({ id: jobId, type: mockJobs.has(jobId) ? 'REPLY_REWEAVE' : 'WEAVE_SCROLL', status: Date.now() < (mockJobs.get(jobId) ?? 0) ? 'RUNNING' : 'SUCCEEDED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  return request<Job>(`/jobs/${jobId}`, { token })
}

export function retryWeave(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve<{ job: Job }>({ job: { id: 'mock-job', type: 'WEAVE_SCROLL', status: 'QUEUED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  return request<{ job: Job }>(`/rooms/${roomId}/weave-jobs`, { method: 'POST', token, idempotent: true })
}

/** 삭제 후 서버가 문단을 복구/재엮는 작업이 끝날 때까지 job을 확인해야 한다. */
export function deleteReply(replyId: string) {
  if (USE_MOCK) {
    for (const [paragraphId, replies] of mockReplies) {
      if (!replies.some(reply => reply.id === replyId)) continue
      const remaining = replies.filter(reply => reply.id !== replyId)
      mockReplies.set(paragraphId, remaining)
      mockReplyCounts.set(paragraphId, remaining.length)
      const previous = mockRewoven.get(paragraphId)
      const original = MEMORY_PHOTOS[Number(paragraphId.split('-').at(-1))]?.firstStory.text ?? ''
      mockRewoven.set(paragraphId, { body: [original, ...remaining.map(reply => reply.transcript)].join('\n'), quote: remaining.at(-1)?.transcript ?? '', version: (previous?.version ?? 1) + 1 })
    }
    return Promise.resolve<{ job: Job }>({ job: { id: 'mock-delete-reply', type: 'REPLY_REWEAVE', status: 'SUCCEEDED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  }
  return request<{ job: Job }>(`/replies/${replyId}`, { method: 'DELETE' })
}

export function createReply(paragraphId: string, token: string, body: { inputMode: 'TEXT' | 'VOICE'; transcript: string; transcriptionId?: string }) {
  if (USE_MOCK) {
    mockReplyCounts.set(paragraphId, (mockReplyCounts.get(paragraphId) ?? 0) + 1)
    mockReplies.set(paragraphId, [...(mockReplies.get(paragraphId) ?? []), { id: `reply-${crypto.randomUUID()}`, memberId: mockMember.id, nickname: mockMember.nickname, transcript: body.transcript, status: 'APPLIED', mine: true, createdAt: new Date().toISOString() }])
    if (!paragraphId.startsWith(`${MOCK_SCROLL_PREVIEW_ROOM_ID}:`)) return Promise.resolve<{ job: Job }>({ job: { id: 'mock-reply-job', type: 'REPLY_REWEAVE', status: 'SUCCEEDED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
    consumeMockReweave()
    const previous = mockRewoven.get(paragraphId)
    const original = MEMORY_PHOTOS[Number(paragraphId.split('-').at(-1))]?.firstStory.text ?? ''
    mockRewoven.set(paragraphId, { body: `${previous?.body ?? original}\n${body.transcript}`, quote: body.transcript, version: (previous?.version ?? 1) + 1 })
    const id = `mock-reply-${crypto.randomUUID()}`
    mockJobs.set(id, Date.now() + 1500)
    return Promise.resolve<{ job: Job }>({ job: { id, type: 'REPLY_REWEAVE', status: 'QUEUED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
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
