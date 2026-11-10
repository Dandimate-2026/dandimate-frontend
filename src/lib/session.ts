// 방마다 이 기기에서 기억해 둘 정보 (방 이름, 방장이 받은 원본 초대 토큰)
// 인증은 카카오 로그인 세션 쿠키로 하므로, 이 정보가 없어도 서버에서는 방에 들어갈 수 있다

import { paths } from '../routes/paths'
import { siteUrl } from './siteUrl'

const KEY_PREFIX = 'duruduru:room:'
const key = (roomId: string) => `${KEY_PREFIX}${roomId}`

export interface RoomSession {
  /** @deprecated 예전 참가자 토큰. 지금은 쿠키로 인증해서 빈 문자열로 둔다 */
  memberAccessToken: string
  /** 방장이 방을 만들 때 한 번만 받는 원본 초대 토큰 */
  inviteToken?: string
  roomName?: string
}

export function saveRoomSession(roomId: string, session: RoomSession) {
  try {
    localStorage.setItem(key(roomId), JSON.stringify(session))
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)은 무시
  }
}

export function getRoomSession(roomId: string): RoomSession | null {
  try {
    const raw = localStorage.getItem(key(roomId))
    if (raw) return JSON.parse(raw) as RoomSession
  } catch {
    // 저장소를 쓸 수 없으면 아래로 넘어간다
  }

  // 실제 서버는 로그인 쿠키로 방 참여 여부를 확인하므로, 이 기기에 저장된 정보가 없어도 방을 열어 본다
  return { memberAccessToken: '' }
}

export function removeRoomSession(roomId: string) {
  try {
    localStorage.removeItem(key(roomId))
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)은 무시
  }
}

/** 이 기기에 토큰이 저장된 방 id 목록 */
export function listSavedRoomIds(): string[] {
  const ids: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(KEY_PREFIX)) ids.push(k.slice(KEY_PREFIX.length))
    }
  } catch {
    // 저장소를 쓸 수 없으면 저장된 방이 없는 것으로 본다
  }
  return ids
}

export function inviteUrl(inviteToken: string) {
  return siteUrl(paths.inviteJoin(inviteToken))
}
