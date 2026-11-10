// 기록 지도와 두루 챗봇 API
import { request } from './client'
import type { FlowerCode } from './types'

export interface MapRoomItem {
  roomId: string
  name: string
  meetingDate: string
  status: string
  scrollReady: boolean
  photoCount: number
  recordCount: number
  summary: string | null
  summaryStatus?: SummaryStatus
}

export type SummaryStatus = 'NONE' | 'GENERATING' | 'READY' | 'FAILED'

export interface CityPin {
  city: string
  /** 시·군 단위 10자리 행정구역 코드. GeoJSON feature와 연결할 때 쓴다 */
  adminAreaCode?: string | null
  /** 그 도시 사진 좌표의 평균 */
  latitude: number
  longitude: number
  photoCount: number
  recordCount: number
  /** 완성된 두루마리가 하나라도 있는지 */
  bloomed: boolean
  /** 그 도시의 가장 최근 두루마리 요약 (AI가 기억하는 한 줄) */
  summary: string | null
  summaryStatus?: SummaryStatus
  rooms: MapRoomItem[]
  /** 이 도시에서 사진마다 고른 장소 (검색으로 고른 장소명) */
  places: MapPlaceItem[]
}

export interface MapPlaceItem {
  photoId: string
  roomId: string
  placeName: string
  city?: string
  adminAreaCode?: string | null
  latitude: number
  longitude: number
  /** 사진 주소 */
  imageUrl?: string | null
  /** 사진을 올린 사람 */
  uploader?: { userId: string; nickname: string; flowerCode: string } | null
  /** 그 사진의 첫 한마디 일부 */
  firstEntrySnippet?: string | null
  /** 카카오 장소 id. 같은 장소인지 이름보다 정확하게 가린다 */
  placeId?: string | null
  placeGroupKey?: string
  recordCount?: number
  recordIds?: string[]
}

/** 도시 평균이 바다·산 사이에 놓이지 않도록 평균에 가장 가까운 실제 기록 장소를 대표로 쓴다. */
export function cityMarkerPosition(pin: CityPin) {
  const places = pin.places.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180)
  const nearest = places.reduce<MapPlaceItem | null>((best, place) => {
    const distance = (p: MapPlaceItem) => (p.latitude - pin.latitude) ** 2 + ((p.longitude - pin.longitude) * Math.cos(pin.latitude * Math.PI / 180)) ** 2
    return !best || distance(place) < distance(best) ? place : best
  }, null)
  return nearest ?? pin
}

/** 같은 장소에서 찍은 사진을 핀 하나로 묶는다 (사진 수 포함) */
export function groupPlaces(places: MapPlaceItem[]) {
  const groups: { place: MapPlaceItem; count: number }[] = []
  for (const place of places) {
    const found = groups.find((g) => samePlace(g.place, place))
    if (found) found.count += 1
    else groups.push({ place, count: 1 })
  }
  return groups
}

/** 같은 장소인지: 둘 다 카카오 장소 id가 있으면 id로, 아니면 이름으로 */
export function samePlace(a: MapPlaceItem, b: MapPlaceItem) {
  if (a.placeGroupKey && b.placeGroupKey) return a.placeGroupKey === b.placeGroupKey
  if (a.placeId && b.placeId) return a.placeId === b.placeId
  return a.placeName === b.placeName && Math.abs(a.latitude - b.latitude) < 0.0001 && Math.abs(a.longitude - b.longitude) < 0.0001
}

/** 기록 지도는 대구·경북만 보여준다. 서버가 주소에서 뽑은 도시 이름(시·군 이름) 기준 */
export const DAEGU_GYEONGBUK_CITIES = [
  '대구', '포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '군위',
  '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉',
]

/** 대구·경북 범위 (울릉도·독도 포함). 이름이 같은 다른 지역 도시를 걸러내려고 좌표도 같이 본다 */
function inDaeguGyeongbuk(pin: CityPin) {
  const inBox = pin.latitude > 35.4 && pin.latitude < 37.6 && pin.longitude > 127.7 && pin.longitude < 131.95
  return inBox && DAEGU_GYEONGBUK_CITIES.includes(pin.city)
}

/** 내가 참여 중인 방의 사진 장소를 도시별로 묶은 지도 */
export async function getMyRecordMap(roomId?: string): Promise<CityPin[]> {
  const query = roomId ? `?roomId=${encodeURIComponent(roomId)}` : ''
  const res = await request<{ cities: CityPin[] }>(`/users/me/map${query}`)
  return res.cities.filter(inDaeguGyeongbuk)
}

export interface ChatAuthor {
  /** 계정 id. 내 사진인지 가릴 때 쓴다 */
  userId?: string
  nickname: string
  flowerCode: FlowerCode
}

export interface ChatSource {
  room: { roomId: string; name: string; meetingDate?: string | null } | null
  photo: { photoId: string; imageUrl: string | null; uploader?: ChatAuthor | null } | null
  /** 그 사진의 첫 한마디 */
  firstEntry?: { text: string; author: ChatAuthor | null } | null
}

/** 답의 근거가 된 원문 한 조각 */
export interface ChatCitation {
  statementIndex: number
  entryId: string | null
  photoId: string | null
  kind: string
  quote: string
  author: ChatAuthor | null
}

/** 서버가 붙여 주는 답의 종류. 기록으로 답했는지, 인사·범위 밖·근거 부족인지 */
export type ChatOutcome = 'ANSWER' | 'CONFLICT' | 'INSUFFICIENT' | 'SMALL_TALK' | 'OUT_OF_SCOPE' | 'INVALID'

export interface ChatAnswer {
  outcome?: ChatOutcome
  answer: string
  sources: ChatSource[]
  citations?: ChatCitation[]
}

/** 두루에게 묻기. conversationId가 같으면 이어서 대화한다 */
export function askDuru(message: string, conversationId: string) {
  // 같은 질문을 두 번 차감하지 않도록 Idempotency-Key를 보낸다 (서버가 이 키로 결과를 다시 돌려준다)
  return request<ChatAnswer>('/chat/messages', { method: 'POST', body: { message, conversationId }, idempotent: true, timeoutMs: 60000 })
}

/** 챗봇 추천에는 지도 표시 지역 밖의 실제 기록 장소도 사용한다. */
export async function getChatPlaceNames(): Promise<string[]> {
  const cities = (await request<{ cities: CityPin[] }>('/users/me/map')).cities
  return [...new Set(cities.flatMap(city => [city.city, ...city.places.map(place => place.placeName)]).filter(Boolean))].slice(0, 12)
}
