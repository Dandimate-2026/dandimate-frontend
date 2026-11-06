// 방 만들기에서 입력한 내용. 플랜을 고른 뒤에야 방을 만들 수 있어서(서버가 방 생성 때 플랜을 받는다)
// 플랜·결제 화면을 지나는 동안 이 기기에 잠깐 들고 있는다
const DRAFT_KEY = 'duruduru:room-draft'

export interface RoomDraft {
  name: string
  meetingDate: string
  hostNickname: string
  capacity: number
}

export function saveRoomDraft(draft: RoomDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // 저장소를 쓸 수 없으면 새로고침 전까지만 화면 상태로 이어간다
  }
}

export function getRoomDraft(): RoomDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as RoomDraft) : null
  } catch {
    return null
  }
}

export function clearRoomDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // 무시
  }
}
