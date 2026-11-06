// 기록 지도와 두루 챗봇 API
import { request } from './client'
import { USE_MOCK } from './mock'

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
  },
  { city: '포항', latitude: 36.04, longitude: 129.36, photoCount: 6, recordCount: 9, bloomed: true, summary: '영일대에서 해 뜨는 걸 기다렸던 새벽.', rooms: [] },
  { city: '대구', latitude: 35.87, longitude: 128.6, photoCount: 5, recordCount: 7, bloomed: false, summary: null, rooms: [] },
  { city: '구미', latitude: 36.12, longitude: 128.34, photoCount: 4, recordCount: 5, bloomed: false, summary: null, rooms: [] },
  { city: '안동', latitude: 36.57, longitude: 128.73, photoCount: 2, recordCount: 3, bloomed: false, summary: null, rooms: [] },
]

/** 내가 참여 중인 방의 사진 장소를 도시별로 묶은 지도 */
export async function getMyRecordMap(): Promise<CityPin[]> {
  if (USE_MOCK) return MOCK_MAP
  const res = await request<{ cities: CityPin[] }>('/users/me/map')
  return res.cities
}

export interface ChatAnswer {
  answer: string
  sources: { room: { roomId: string; name: string } | null }[]
}

/** 두루에게 묻기. conversationId가 같으면 이어서 대화한다 */
export function askDuru(message: string, conversationId: string) {
  if (USE_MOCK) {
    return Promise.resolve<ChatAnswer>({
      answer: `데모에서는 실제 기록을 찾아볼 수 없어요. "${message}"에 대한 답은 실제 서버에서 확인해 주세요.`,
      sources: [],
    })
  }
  return request<ChatAnswer>('/chat/messages', { method: 'POST', body: { message, conversationId } })
}
