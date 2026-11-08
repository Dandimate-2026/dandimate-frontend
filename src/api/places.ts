// 장소 검색: 서버가 카카오 장소 검색을 대신 불러 준다 (프론트에 카카오 키가 필요 없다)
import { request } from './client'
import { USE_MOCK } from './mock'

export interface Place {
  placeName: string
  address: string
  /** 기록 지도에서 묶는 도시 이름 (예: 경주) */
  city: string
  latitude: number
  longitude: number
  /** 카카오 장소 id (사진 장소 저장 때 같이 보낸다) */
  placeId?: string | null
}

const MOCK_PLACES: Place[] = [
  { placeName: '황리단길', address: '경북 경주시 포석로 1080', city: '경주', latitude: 35.8381, longitude: 129.2097 },
  { placeName: '첨성대', address: '경북 경주시 인왕동 839-1', city: '경주', latitude: 35.8347, longitude: 129.2190 },
  { placeName: '보문호수', address: '경북 경주시 신평동', city: '경주', latitude: 35.8455, longitude: 129.2836 },
  { placeName: '쉐이크쉑 대구동성로점', address: '대구 중구 동성로6길 61', city: '대구', latitude: 35.8693, longitude: 128.5960 },
  { placeName: '영일대 해수욕장', address: '경북 포항시 북구 두호동', city: '포항', latitude: 36.0568, longitude: 129.3780 },
]

export function searchPlaces(query: string) {
  if (USE_MOCK) {
    return Promise.resolve(MOCK_PLACES.filter((p) => `${p.placeName} ${p.address}`.includes(query)))
  }
  return request<Place[]>(`/places/search?query=${encodeURIComponent(query)}`)
}

/**
 * 사진에 장소를 붙인다 (사진을 올린 본인만, 처리가 끝난 사진만).
 * 주소·좌표까지 보내야 기록 지도에 나온다. 도시는 서버가 주소에서 정한다
 */
export function setPhotoLocation(photoId: string, place: Place) {
  if (USE_MOCK) return Promise.resolve()
  return request<unknown>(`/photos/${photoId}/location`, {
    method: 'PUT',
    body: {
      placeName: place.placeName,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      placeId: place.placeId ?? undefined,
    },
  })
}

/** 사진의 장소를 지운다 (기록 지도에서 빠진다). 올린 본인만 */
export function removePhotoLocation(photoId: string) {
  if (USE_MOCK) return Promise.resolve()
  return request<void>(`/photos/${photoId}/location`, { method: 'DELETE' })
}
