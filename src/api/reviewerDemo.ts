import { request } from './client'

export interface ReviewerDemo {
  hostRoomId: string
  memberRoomId: string
  completedRoomId: string
}

export type ReviewerDemoState = {
  enabled: boolean
  hostRoomId: string | null
  memberRoomId: string | null
  completedRoomId: string | null
  rooms: { roomId: string; name: string; status: string; role: 'HOST' | 'MEMBER'; experience: 'HOST' | 'MEMBER' | 'COMPLETED' }[]
}

export function getReviewerDemo() {
  return request<ReviewerDemoState>('/reviewer-demo')
}

export function setReviewerDemoEnabled(enabled: boolean) {
  return request<ReviewerDemoState>('/reviewer-demo', { method: 'PUT', body: { enabled } })
}

/** 로그인 계정에 심사용 예시 방을 연결한다. 재호출 시 기존 방을 반환한다. */
export async function activateReviewerDemo(): Promise<ReviewerDemo> {
  const result = await setReviewerDemoEnabled(true)
  if (!result.enabled || !result.hostRoomId || !result.memberRoomId || !result.completedRoomId) throw new Error('데모 방 정보를 확인하지 못했어요.')
  return { hostRoomId: result.hostRoomId, memberRoomId: result.memberRoomId, completedRoomId: result.completedRoomId }
}
