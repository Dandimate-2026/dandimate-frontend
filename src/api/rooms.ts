import { request } from './client'
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
  RoomPlace,
} from './types'

/** 방 정원 최댓값 (방장 포함). 방마다 1~8명 중 고를 수 있다 */
export const ROOM_CAPACITY = 8
/** 방 만들 때 고를 수 있는 최소 인원. 혼자 다녀온 여행도 남길 수 있게 1명부터 (서버도 1~8명을 받는다) */
export const MIN_ROOM_CAPACITY = 1
/** 서버에 약관 버전을 못 물어볼 때 쓰는 기본값 (서버 기본값과 같다) */
export const CONSENT: Consent = {
  version: 'v1',
  terms: true,
  mediaProcessing: true,
  externalAiProcessing: true,
}

/**
 * 방 만들기·입장·결제 때 보낼 약관 동의. 서버가 지금 쓰는 약관 버전(GET /consents/current)을 받아서 보낸다.
 * 버전이 다르면 서버가 CONSENT_REQUIRED로 거절해서, 서버 값을 따른다. 조회에 실패하면 동의를 임의의 버전으로 보내지 않는다
 */
export async function currentConsent(): Promise<Consent> {
  const { version } = await request<{ version: string; consented: boolean }>('/consents/current')
  if (!version?.trim()) throw new Error('약관 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return { ...CONSENT, version }
}

/** 로그인한 계정이 참여 중인 방 목록 */
export function getMyRooms() {
  return request<MyRoom[]>('/users/me/rooms')
}

/** 로그인한 사용자가 방을 만들고 방장이 된다 */
export async function createRoom(body: Omit<CreateRoomRequest, 'consent'>) {
  const payload: CreateRoomRequest = { ...body, consent: await currentConsent() }
  const result = await request<CreateRoomResult>('/rooms', { method: 'POST', body: payload, idempotent: true })

  return result
}

export function getInvitePreview(inviteToken: string) {
  return request<InvitePreview>(`/invites/${inviteToken}`)
}

export async function joinRoom(inviteToken: string, nickname: string) {
  return request<JoinRoomResult>(`/invites/${inviteToken}/join`, {
    method: 'POST',
    body: { nickname, consent: await currentConsent() },
    idempotent: true,
  })
}

export function getRoomHome(roomId: string, token: string) {
  return request<RoomHome>(`/rooms/${roomId}`, { token })
}

/** 방장이 마감 시각 전에 방을 닫고 두루마리 엮기를 시작한다 */
export function closeRoom(roomId: string, token: string) {
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
  /** place: 모임 장소. 빼면 그대로, null이면 지운다 */
  body: { name?: string; meetingDate?: string; deadlineAt?: string | null; capacity?: number; coverImageUrl?: string; place?: RoomPlace | null; scrollTemplateId?: string },
  token: string,
) {
  return request(`/rooms/${roomId}`, { method: 'PATCH', body: { ...body, ...(body.scrollTemplateId ? { scrollTemplateId: body.scrollTemplateId === 'minimal' ? 'CLASSIC' : body.scrollTemplateId.toUpperCase() } : {}) }, token })
}

/** 이 방에서 쓰는 내 닉네임을 바꾼다. 방 안에 같은 이름이 있으면 409(NICKNAME_TAKEN) */
export function updateMyNickname(roomId: string, nickname: string, token: string) {
  return request(`/rooms/${roomId}/members/me`, { method: 'PATCH', body: { nickname }, token })
}

/**
 * 일반 멤버가 방에서 나간다. 내가 남긴 사진·이야기는 방에 그대로 남는다.
 * 같은 초대 링크로 다시 들어오면 예전 이름·기록을 이어 쓴다. 방장은 나갈 수 없다(403)
 */
export function leaveRoom(roomId: string) {
  return request(`/rooms/${roomId}/members/me`, { method: 'DELETE' })
}

/** 방장이 같은 방의 다른 멤버에게 방장을 넘긴다. 나는 일반 멤버가 된다 */
export function transferHost(roomId: string, memberId: string) {
  return request(`/rooms/${roomId}/host-transfer`, { method: 'POST', body: { memberId }, idempotent: true })
}

/** 방장이 멤버를 방에서 내보낸다 (강퇴). 방장만 할 수 있고, 내보낸 사람은 같은 초대 링크로 다시 들어올 수 없다 */
export function kickMember(roomId: string, memberId: string) {
  return request(`/rooms/${roomId}/members/${memberId}`, { method: 'DELETE' })
}

/** 이 방의 고정 초대 토큰 (방 참가자 누구나). 초대 링크는 바뀌지 않는다 */
export async function getRoomInvite(roomId: string) {
  const { inviteToken } = await request<{ inviteToken: string }>(`/rooms/${roomId}/invite`)
  return inviteToken
}

/** 방장이 방과 모든 사진·이야기를 지운다 */
export function deleteRoom(roomId: string, token: string) {
  return request(`/rooms/${roomId}`, { method: 'DELETE', token })
}

/**
 * 멤버가 방장에게 플랜을 바꿔 달라고 요청한다. 방장의 방 알림(🔔)에 PLAN_UPGRADE_REQUESTED로 들어간다.
 * FREE·LITE 방의 일반 멤버가 상위 플랜을 요청한다. 생략하면 다음 상위 플랜을 요청한다
 */
export function requestPlanUpgrade(roomId: string, reason: PlanRequestReason, targetPlan?: 'LITE' | 'PRO') {
  return request(`/rooms/${roomId}/plan-requests`, { method: 'POST', body: { reason, ...(targetPlan ? { targetPlan } : {}) }, idempotent: true })
}
