import { request } from './client'
import { mockNotifications, USE_MOCK } from './mock'
import type { EventToken, RoomNotification } from './types'

/** 이 방에서 나에게 온 알림 목록 */
export function getNotifications(roomId: string, token: string) {
  if (USE_MOCK) return Promise.resolve(mockNotifications)
  return request<RoomNotification[]>(`/rooms/${roomId}/notifications`, { token })
}

export function markNotificationRead(notificationId: string, token: string) {
  if (USE_MOCK) return Promise.resolve()
  return request(`/notifications/${notificationId}/read`, { method: 'POST', token })
}

/** 실시간 이벤트(SSE)에 붙기 위한 1회용 주소를 받는다 (60초 안에 써야 한다) */
export function issueEventToken(roomId: string, token: string) {
  return request<EventToken>(`/rooms/${roomId}/event-token`, { method: 'POST', token })
}

/** 참여 중인 모든 모임방의 알림. */
export function getAllNotifications() {
  if (USE_MOCK) return Promise.resolve(mockNotifications)
  return request<(RoomNotification & { roomId: string; roomName: string })[]>('/notifications')
}
