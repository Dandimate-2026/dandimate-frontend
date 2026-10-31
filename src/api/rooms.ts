import { request } from './client'
import { mockInvitePreview, mockJoinRoom, USE_MOCK } from './mock'
import type { Consent, InvitePreview, JoinRoomResult } from './types'

// TODO: 백엔드와 약관 버전 값 확정 필요
export const CONSENT: Consent = {
  version: '2026-10',
  terms: true,
  mediaProcessing: true,
  externalAiProcessing: true,
}

export function getInvitePreview(inviteToken: string) {
  if (USE_MOCK) return Promise.resolve(mockInvitePreview)
  return request<InvitePreview>(`/invites/${inviteToken}`)
}

export function joinRoom(inviteToken: string, nickname: string) {
  if (USE_MOCK) return Promise.resolve(mockJoinRoom(nickname))
  return request<JoinRoomResult>(`/invites/${inviteToken}/join`, {
    method: 'POST',
    body: { nickname, consent: CONSENT },
    idempotent: true,
  })
}
