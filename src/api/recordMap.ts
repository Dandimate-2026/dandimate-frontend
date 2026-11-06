// 기록 지도와 두루 챗봇 API
import { request } from './client'
import { USE_MOCK } from './mock'
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
}

export interface CityPin {
  city: string
  /** 그 도시 사진 좌표의 평균 */
  latitude: number
  longitude: number
  photoCount: number
  recordCount: number
  /** 완성된 두루마리가 하나라도 있는지 */
  bloomed: boolean
  /** 그 도시의 가장 최근 두루마리 요약 (AI가 기억하는 한 줄) */
  summary: string | null
  rooms: MapRoomItem[]
  /** 이 도시에서 사진마다 고른 장소 (검색으로 고른 장소명) */
  places: MapPlaceItem[]
}

export interface MapPlaceItem {
  photoId: string
  roomId: string
  placeName: string
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
  if (a.placeId && b.placeId) return a.placeId === b.placeId
  return a.placeName === b.placeName
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

const MOCK_MAP: CityPin[] = [
  {
    city: '경주',
    latitude: 35.84,
    longitude: 129.22,
    photoCount: 9,
    recordCount: 12,
    bloomed: true,
    summary: '비 오던 날 황리단길에서 다 같이 젖었던 여행. 다음엔 보문호수 가자던 얘기가 남아 있어요.',
    rooms: [
      { roomId: 'demo', name: '경주 1박2일', meetingDate: '2026-10-17', status: 'GROWING', scrollReady: true, photoCount: 6, recordCount: 9, summary: null },
      { roomId: 'demo2', name: '칩셋 가을 MT', meetingDate: '2026-11-01', status: 'CIRCULATING', scrollReady: false, photoCount: 3, recordCount: 3, summary: null },
    ],
    places: [
      { photoId: 'p1', roomId: 'demo', placeName: '첨성대', latitude: 35.8347, longitude: 129.219 },
      { photoId: 'p2', roomId: 'demo', placeName: '황리단길', latitude: 35.8381, longitude: 129.2097 },
      { photoId: 'p3', roomId: 'demo2', placeName: '보문호수', latitude: 35.8455, longitude: 129.2836 },
    ],
  },
  { city: '포항', latitude: 36.04, longitude: 129.36, photoCount: 6, recordCount: 9, bloomed: true, summary: '영일대에서 해 뜨는 걸 기다렸던 새벽.', rooms: [{ roomId: 'demo2', name: '칩셋 가을 MT', meetingDate: '2026-11-01', status: 'CIRCULATING', scrollReady: false, photoCount: 1, recordCount: 2, summary: null }], places: [{ photoId: 'p4', roomId: 'demo2', placeName: '영일대 해수욕장', latitude: 36.0568, longitude: 129.378 }] },
  { city: '대구', latitude: 35.87, longitude: 128.6, photoCount: 5, recordCount: 7, bloomed: false, summary: null, rooms: [], places: [] },
  { city: '구미', latitude: 36.12, longitude: 128.34, photoCount: 4, recordCount: 5, bloomed: false, summary: null, rooms: [], places: [] },
  { city: '안동', latitude: 36.57, longitude: 128.73, photoCount: 2, recordCount: 3, bloomed: false, summary: null, rooms: [], places: [] },
]

/** 내가 참여 중인 방의 사진 장소를 도시별로 묶은 지도 */
export async function getMyRecordMap(): Promise<CityPin[]> {
  if (USE_MOCK) return MOCK_MAP.filter(inDaeguGyeongbuk)
  const res = await request<{ cities: CityPin[] }>('/users/me/map')
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
  if (USE_MOCK) {
    return Promise.resolve<ChatAnswer>({
      answer: `첨성대 앞 단체 사진 얘기 같아요! 그런데 친구들 기억이 조금 달라요 😆 (데모 답이에요: "${message}")`,
      sources: [{ room: { roomId: 'demo', name: '경주 1박2일' }, photo: { photoId: 'p1', imageUrl: null, uploader: { nickname: '서연', flowerCode: 'AZALEA' } }, firstEntry: { text: '첨성대 앞에서 다 같이 찍은 사진!', author: { nickname: '서연', flowerCode: 'AZALEA' } } }],
      citations: [
        { statementIndex: 0, entryId: 'e1', photoId: 'p1', kind: 'FIRST_ENTRY', quote: '민지가 계단에서 미끄러졌는데 다같이 빵 터짐', author: { nickname: '서연', flowerCode: 'AZALEA' } },
        { statementIndex: 0, entryId: 'e2', photoId: 'p1', kind: 'ADDON', quote: '사실 일부러 앉은거임', author: { nickname: '민지', flowerCode: 'FORSYTHIA' } },
      ],
    })
  }
  // 같은 질문을 두 번 차감하지 않도록 Idempotency-Key를 보낸다 (서버가 이 키로 결과를 다시 돌려준다)
  return request<ChatAnswer>('/chat/messages', { method: 'POST', body: { message, conversationId }, idempotent: true })
}
