import { request } from './client'
import {
  MOCK_NEW_ROOM_ID,
  mockCreateRoom,
  mockInvitePreview,
  mockJoinRoom,
  mockNewRoomHome,
  mockRoomHome,
  USE_MOCK,
} from './mock'
import type { Consent, CreateRoomRequest, CreateRoomResult, InvitePreview, JoinRoomResult, RoomHome } from './types'

/** 방 정원 (백엔드 명세상 고정값) */
export const ROOM_CAPACITY = 8

// TODO: 백엔드와 약관 버전 값 확정 필요
export const CONSENT: Consent = {
  version: '2026-10',
  terms: true,
  mediaProcessing: true,
  externalAiProcessing: true,
}

export function createRoom(body: Omit<CreateRoomRequest, 'consent'>) {
  const payload: CreateRoomRequest = { ...body, consent: CONSENT }
  if (USE_MOCK) return Promise.resolve(mockCreateRoom(payload))
  return request<CreateRoomResult>('/rooms', { method: 'POST', body: payload, idempotent: true })
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

export function getRoomHome(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve(roomId === MOCK_NEW_ROOM_ID ? mockNewRoomHome : mockRoomHome)
  return request<RoomHome>(`/rooms/${roomId}`, { token })
}
