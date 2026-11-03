import { request } from './client'
import {
  MOCK_DONE_ROOM_ID,
  MOCK_NEW_ROOM_ID,
  MOCK_READY_ROOM_ID,
  mockCloseRoom,
  mockCreateRoom,
  mockDoneRoomHome,
  mockInvitePreview,
  mockJoinRoom,
  mockNewRoomHome,
  mockReadyRoomHome,
  mockRoomHome,
  USE_MOCK,
} from './mock'
import type {
  CloseRoomResult,
  Consent,
  CreateRoomRequest,
  CreateRoomResult,
  InvitePreview,
  JoinRoomResult,
  RoomHome,
} from './types'

/** 방 정원 (백엔드 명세상 고정값) */
export const ROOM_CAPACITY = 8
/** 방 만들 때 고를 수 있는 최소 인원 */
export const MIN_ROOM_CAPACITY = 2

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
  if (USE_MOCK) {
    if (roomId === MOCK_NEW_ROOM_ID) return Promise.resolve(mockNewRoomHome)
    if (roomId === MOCK_DONE_ROOM_ID) return Promise.resolve(mockDoneRoomHome)
    if (roomId === MOCK_READY_ROOM_ID) return Promise.resolve(mockReadyRoomHome)
    return Promise.resolve(mockRoomHome)
  }
  return request<RoomHome>(`/rooms/${roomId}`, { token })
}

/** 방장이 마감 시각 전에 방을 닫고 두루마리 엮기를 시작한다 */
export function closeRoom(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve(mockCloseRoom())
  return request<CloseRoomResult>(`/rooms/${roomId}/close`, {
    method: 'POST',
    body: { mode: 'EARLY' },
    token,
    idempotent: true,
  })
}
