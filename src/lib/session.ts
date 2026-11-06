// 계정 없이 방에 들어오므로, 방마다 받은 토큰을 기기에 저장해 둔다
import { MOCK_INVITE_TOKEN, MOCK_READY_ROOM_ID, MOCK_ROOM_IDS, MOCK_SCROLL_PREVIEW_ROOM_ID, USE_MOCK } from '../api/mock'
import { paths } from '../routes/paths'

const KEY_PREFIX = 'duruduru:room:'
const key = (roomId: string) => `${KEY_PREFIX}${roomId}`

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
  try {
    const raw = localStorage.getItem(key(roomId))
    if (raw) return JSON.parse(raw) as RoomSession
  } catch {
    // 저장소를 쓸 수 없으면 아래로 넘어간다
  }
  // mock 모드에서는 방을 만들거나 입장하지 않고 바로 들어와도 화면을 볼 수 있게 한다
  if (USE_MOCK && (MOCK_ROOM_IDS.includes(roomId) || roomId === MOCK_READY_ROOM_ID || roomId === MOCK_SCROLL_PREVIEW_ROOM_ID)) {
    return { memberAccessToken: 'mock-token', inviteToken: MOCK_INVITE_TOKEN, roomName: '경주 1박2일' }
  }
  return null
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
  // mock 모드에서는 방을 만들지 않아도 예시 방 목록을 볼 수 있게 한다
  if (USE_MOCK) return MOCK_ROOM_IDS
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
  return `${window.location.origin}${paths.inviteJoin(inviteToken)}`
}
