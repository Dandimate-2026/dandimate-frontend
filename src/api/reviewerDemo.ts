import { request } from './client'

export interface ReviewerDemo {
  hostRoomId: string
  memberRoomId: string
  completedRoomId: string
}

/** 로그인 계정에 심사용 예시 방을 연결한다. 재호출 시 기존 방을 반환한다. */
export function activateReviewerDemo() {
  return request<ReviewerDemo>('/reviewer-demo/activate', { method: 'POST' })
}
