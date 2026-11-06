// 사진마다 "마지막으로 본 이야기 수"를 이 기기에 기억해 두고, 그보다 늘어난 만큼을 새 이야기로 보여준다
const key = (roomId: string) => `duruduru:seen-stories:${roomId}`

type SeenMap = Record<string, number>

export function getSeenStories(roomId: string): SeenMap | null {
  try {
    const raw = localStorage.getItem(key(roomId))
    return raw ? (JSON.parse(raw) as SeenMap) : null
  } catch {
    return null
  }
}

export function saveSeenStories(roomId: string, seen: SeenMap) {
  try {
    localStorage.setItem(key(roomId), JSON.stringify(seen))
  } catch {
    // 저장하지 못하면 다음에 들어왔을 때 배지가 다시 보일 뿐이다
  }
}
