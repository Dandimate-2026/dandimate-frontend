import { request } from './client'
import {
  asMockRole,
  withMockActivity,
  MOCK_DONE_ROOM_ID,
  MOCK_SCROLL_PREVIEW_ROOM_ID,
  withMockQuota,
  MOCK_INVITE_TOKEN,
  MOCK_NEW_ROOM_ID,
  MOCK_READY_ROOM_ID,
  MOCK_TIMEUP_ROOM_ID,
  MOCK_LIMIT_ROOM_ID,
  MOCK_UNLIMITED_ROOM_ID,
  mockCloseRoom,
  mockCreateRoom,
  mockDoneRoomHome,
  mockInvitePreview,
  mockJoinRoom,
  mockNewRoomHome,
  mockReadyRoomHome,
  mockRoomHome,
  mockTimeUpRoomHome,
  mockLimitRoomHome,
  mockUnlimitedRoomHome,
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
  PlanRequestReason,
  RoomHome,
} from './types'

/** 방 정원 최댓값 (방장 포함). 방마다 1~8명 중 고를 수 있다 */
export const ROOM_CAPACITY = 8
/** 방 만들 때 고를 수 있는 최소 인원. 혼자 다녀온 여행도 남길 수 있게 1명부터 (서버도 1~8명을 받는다) */
export const MIN_ROOM_CAPACITY = 1
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
  if (USE_MOCK && roomId === MOCK_SCROLL_PREVIEW_ROOM_ID) {
    const preview = { ...mockDoneRoomHome, room: { ...mockDoneRoomHome.room,
      id: MOCK_SCROLL_PREVIEW_ROOM_ID, name: '경주 1박2일', planType: 'PRO' as const,
      quota: { ...mockDoneRoomHome.room.quota, regenerationLimit: 12, regenerationCount: 0, regenerationsRemaining: 12 },
    } }
    return Promise.resolve(withMockQuota(withMockActivity(asMockRole(preview))))
  }
  // 역할을 먼저 정하고, 그 '나'에게 이 기기에서 남긴 사진·한마디를 반영한다
  if (USE_MOCK) return Promise.resolve(withMockActivity(asMockRole(mockRoomHomeById(roomId))))
  return request<RoomHome>(`/rooms/${roomId}`, { token })
}

function mockRoomHomeById(roomId: string) {
  if (roomId === MOCK_NEW_ROOM_ID) return mockNewRoomHome
  if (roomId === MOCK_DONE_ROOM_ID) return mockDoneRoomHome
  if (roomId === MOCK_READY_ROOM_ID) return mockReadyRoomHome
  if (roomId === MOCK_TIMEUP_ROOM_ID) return mockTimeUpRoomHome
  if (roomId === MOCK_LIMIT_ROOM_ID) return mockLimitRoomHome
  if (roomId === MOCK_UNLIMITED_ROOM_ID) return mockUnlimitedRoomHome
  return mockRoomHome
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
  /** capacity: 방장이 인원을 바꾼다 (지금 들어온 인원 이상 ~ 8명). 백엔드 반영 전에는 서버가 무시하거나 거절할 수 있다 */
  body: { name?: string; meetingDate?: string; deadlineAt?: string; capacity?: number },
  token: string,
) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}`, { method: 'PATCH', body, token })
}

/** 이 방에서 쓰는 내 닉네임을 바꾼다. 방 안에 같은 이름이 있으면 409(NICKNAME_TAKEN) */
export function updateMyNickname(roomId: string, nickname: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}/members/me`, { method: 'PATCH', body: { nickname }, token })
}

/**
 * 일반 멤버가 방에서 나간다. 내가 남긴 사진·이야기는 방에 그대로 남는다.
 * 같은 초대 링크로 다시 들어오면 예전 이름·기록을 이어 쓴다. 방장은 나갈 수 없다(403)
 */
export function leaveRoom(roomId: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}/members/me`, { method: 'DELETE' })
}

/** 방장이 같은 방의 다른 멤버에게 방장을 넘긴다. 나는 일반 멤버가 된다 */
export function transferHost(roomId: string, memberId: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}/host-transfer`, { method: 'POST', body: { memberId }, idempotent: true })
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

/**
 * 멤버가 방장에게 플랜을 바꿔 달라고 요청한다. 방장의 방 알림(🔔)에 PLAN_UPGRADE_REQUESTED로 들어간다.
 * Free 방의 일반 멤버만 보낼 수 있다 (방장이거나 Lite·Pro 방이면 403)
 */
export function requestPlanUpgrade(roomId: string, reason: PlanRequestReason) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/rooms/${roomId}/plan-requests`, { method: 'POST', body: { reason }, idempotent: true })
}
