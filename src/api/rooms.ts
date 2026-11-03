import { request } from './client'
import {
  MOCK_DONE_ROOM_ID,
  MOCK_INVITE_TOKEN,
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
  MyRoom,
  RoomHome,
} from './types'

/** 방 정원 최댓값 (방장 포함). 방마다 1~8명 중 고를 수 있다 */
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

/** 로그인한 계정이 참여 중인 방 목록 */
export function getMyRooms() {
  if (USE_MOCK) return Promise.resolve<MyRoom[] | null>(null)
  return request<MyRoom[]>('/users/me/rooms')
}

/** 로그인한 사용자가 방을 만들고 방장이 된다 */
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

/** 방장이 모임방 이름·모임 날짜·첫 두루마리 시각을 바꾼다 */
export function updateRoom(
  roomId: string,
  body: { name?: string; meetingDate?: string; deadlineAt?: string },
  token: string,
) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}`, { method: 'PATCH', body, token })
}

/**
 * 이 방에서 쓰는 내 닉네임을 바꾼다
 * TODO(백엔드 미지원): 공개 API 0.1.0에 닉네임 변경이 없다. 주소·요청 모양은 가정한 값이라 실제 모드에서는 실패한다
 */
export function updateMyNickname(roomId: string, nickname: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}/members/me`, { method: 'PATCH', body: { nickname }, token })
}

/** 방장이 초대 링크를 새로 만든다. 이전 링크로는 더 들어올 수 없다 */
export async function rotateInviteToken(roomId: string, token: string) {
  if (USE_MOCK) return MOCK_INVITE_TOKEN
  const { inviteToken } = await request<{ inviteToken: string }>(`/rooms/${roomId}/invite-token/rotate`, {
    method: 'POST',
    token,
    idempotent: true,
  })
  return inviteToken
}

/** 방장이 방과 모든 사진·이야기를 지운다 */
export function deleteRoom(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}`, { method: 'DELETE', token })
}
