// 방 만들기에서 고른 장소·대표 사진.
// 서버 방 생성 API에 아직 이 칸이 없어서, 서버로 보내는 입력(roomDraft)과 따로 이 기기에만 들고 있는다
const EXTRAS_KEY = 'duruduru:room-draft-extras'
const RECENT_PLACES_KEY = 'duruduru:recent-places'
const MAX_RECENT_PLACES = 3

export interface RoomExtras {
  /** 화면에 보이는 장소 이름 (도시 또는 검색한 장소명) */
  place?: string
  /** 검색으로 골랐을 때의 주소·좌표 (서버에 장소 칸이 생기면 같이 보낸다) */
  placeDetail?: { address: string; city: string; latitude: number; longitude: number }
  /** 작게 줄인 대표 사진 (data URL) */
  coverPhoto?: string
}

export function saveRoomExtras(extras: RoomExtras) {
  try {
    sessionStorage.setItem(EXTRAS_KEY, JSON.stringify(extras))
  } catch {
    // 사진이 커서 못 담으면 장소만이라도 남긴다
    try {
      sessionStorage.setItem(EXTRAS_KEY, JSON.stringify({ place: extras.place }))
    } catch {
      // 무시
    }
  }
}

export function getRoomExtras(): RoomExtras {
  try {
    const raw = sessionStorage.getItem(EXTRAS_KEY)
    return raw ? (JSON.parse(raw) as RoomExtras) : {}
  } catch {
    return {}
  }
}

export function getRecentPlaces(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PLACES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function addRecentPlace(place: string) {
  try {
    const next = [place, ...getRecentPlaces().filter((p) => p !== place)].slice(0, MAX_RECENT_PLACES)
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next))
  } catch {
    // 무시
  }
}

/** 고른 사진을 목록 썸네일 크기로 줄여 data URL로 만든다 */
export function shrinkImage(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('사진을 열 수 없어요'))
    }
    img.src = url
  })
}

// 방을 만든 뒤에는 방마다 따로 기억한다 (서버에 칸이 생기면 서버 값으로 바꾼다)
const roomKey = (roomId: string) => `duruduru:room-extras:${roomId}`

export function getRoomPlaceCover(roomId: string): RoomExtras {
  try {
    const raw = localStorage.getItem(roomKey(roomId))
    return raw ? (JSON.parse(raw) as RoomExtras) : {}
  } catch {
    return {}
  }
}

export function saveRoomPlaceCover(roomId: string, extras: RoomExtras) {
  try {
    localStorage.setItem(roomKey(roomId), JSON.stringify(extras))
    return true
  } catch {
    return false
  }
}

/** 방 만들기에서 고른 장소·대표 사진을 새로 만든 방에 옮겨 둔다 */
export function attachDraftExtras(roomId: string) {
  const extras = getRoomExtras()
  if (extras.place || extras.coverPhoto) saveRoomPlaceCover(roomId, extras)
  try {
    sessionStorage.removeItem(EXTRAS_KEY)
  } catch {
    // 무시
  }
}
