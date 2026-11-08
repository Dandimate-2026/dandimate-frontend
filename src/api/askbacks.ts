import { request } from './client'
import { mockAskback, mockTranscribe, USE_MOCK } from './mock'
import type { Askback, AskbackAnswerRequest, AskbackQueue, TranscriptionDraft } from './types'

const mockStatuses = new Map<string, Askback['status']>()
const mockQuestion = (): Askback => ({ ...mockAskback, status: mockStatuses.get(mockAskback.id) ?? mockAskback.status })

export async function getMyAskbacks(roomId: string): Promise<Askback[]> {
  if (USE_MOCK) return [mockQuestion()]
  const { askbacks } = await request<{ askbacks: Askback[] }>(`/rooms/${roomId}/askbacks/me`)
  return askbacks
}

export function getNextAskback(roomId: string): Promise<AskbackQueue> {
  if (USE_MOCK) {
    const question = mockQuestion()
    const pending = question.status === 'PENDING'
    return Promise.resolve({ nextAskback: pending ? question : null, remainingCount: pending ? 1 : 0, completed: !pending })
  }
  return request<AskbackQueue>(`/rooms/${roomId}/askbacks/next`)
}

export function passAskback(askbackId: string): Promise<AskbackQueue> {
  if (USE_MOCK) {
    mockStatuses.set(askbackId, 'SKIPPED')
    return Promise.resolve({ nextAskback: null, remainingCount: 0, completed: true })
  }
  return request<AskbackQueue>(`/askbacks/${askbackId}/pass`, { method: 'POST' })
}

/** 서버가 데모 모드를 허용한 경우에만 실행 가능한 방장용 분석 요청. */
export function runAskbackAnalysis(roomId: string) {
  if (USE_MOCK) { mockStatuses.clear(); return Promise.resolve({ job: { id: 'mock-analysis' } }) }
  return request<{ job: { id: string } }>(`/rooms/${roomId}/askbacks/run`, { method: 'POST', idempotent: true })
}

/** 나에게 온 질문 하나. 질문을 받은 사람만 볼 수 있다 */
export async function getAskback(askbackId: string, token: string) {
  if (USE_MOCK) return mockQuestion()
  const { askback } = await request<{ askback: Askback }>(`/askbacks/${askbackId}`, { token })
  return askback
}

/** 답을 녹음한 파일을 보내고, 받아 적은 글 초안을 받는다 */
export function transcribeAskback(askbackId: string, token: string, audio: Blob) {
  if (USE_MOCK) return mockTranscribe('계단에서 미끄러졌는데 다들 웃느라 아무도 안 잡아줬어요.')
  const form = new FormData()
  form.append('file', audio, `voice.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  return request<TranscriptionDraft>(`/askbacks/${askbackId}/transcriptions`, { method: 'POST', body: form, token, idempotent: true })
}

/** 답을 확정한다. 답은 그 사진의 이야기로 남는다 */
export function answerAskback(askbackId: string, token: string, answer: AskbackAnswerRequest) {
  if (USE_MOCK) { mockStatuses.set(askbackId, 'ANSWERED'); return Promise.resolve() }
  return request(`/askbacks/${askbackId}/answer`, { method: 'POST', body: answer, token, idempotent: true })
}

/** "기억 안 나요". 같은 사진으로는 다시 묻지 않는다 */
export function forgetAskback(askbackId: string, token: string) {
  if (USE_MOCK) { mockStatuses.set(askbackId, 'FORGOT'); return Promise.resolve() }
  return request(`/askbacks/${askbackId}/forgot`, { method: 'POST', token, idempotent: true })
}

/** "나중에". 질문은 그대로 남는다 */
export function postponeAskback(askbackId: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/askbacks/${askbackId}/postpone`, { method: 'POST', token })
}
