// 계정 없이 방에 들어오므로, 방마다 받은 토큰을 기기에 저장해 둔다
import { MOCK_INVITE_TOKEN, MOCK_ROOM_ID, USE_MOCK } from '../api/mock'
import { paths } from '../routes/paths'

const key = (roomId: string) => `duruduru:room:${roomId}`

export interface RoomSession {
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
  // 방 만들기 화면이 생기기 전까지 공유 화면 확인용
  if (USE_MOCK && roomId === MOCK_ROOM_ID) {
    return { memberAccessToken: 'mock-token', inviteToken: MOCK_INVITE_TOKEN, roomName: '경주 1박2일' }
  }
  try {
    const raw = localStorage.getItem(key(roomId))
    return raw ? (JSON.parse(raw) as RoomSession) : null
  } catch {
    return null
  }
}

export function inviteUrl(inviteToken: string) {
  return `${window.location.origin}${paths.inviteJoin(inviteToken)}`
}
