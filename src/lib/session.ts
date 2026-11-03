// 방마다 이 기기에서 기억해 둘 정보 (방 이름, 방장이 받은 원본 초대 토큰)
// 인증은 카카오 로그인 세션 쿠키로 하므로, 이 정보가 없어도 서버에서는 방에 들어갈 수 있다
import { MOCK_INVITE_TOKEN, MOCK_ROOM_IDS, USE_MOCK } from '../api/mock'
import { paths } from '../routes/paths'

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
  // mock 모드에서는 방을 만들거나 입장하지 않고 바로 들어와도 화면을 볼 수 있게 한다
  if (USE_MOCK && MOCK_ROOM_IDS.includes(roomId)) {
    return { memberAccessToken: 'mock-token', inviteToken: MOCK_INVITE_TOKEN, roomName: '경주 1박2일' }
  }
  if (USE_MOCK) return null
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
