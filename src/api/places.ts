// 장소 검색: 서버가 카카오 장소 검색을 대신 불러 준다 (프론트에 카카오 키가 필요 없다)
import { request } from './client'

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

export function searchPlaces(query: string) {
  return request<Place[]>(`/places/search?query=${encodeURIComponent(query)}`)
}

/**
 * 사진에 장소를 붙인다 (사진을 올린 본인만, 처리가 끝난 사진만).
 * 주소·좌표까지 보내야 기록 지도에 나온다. 도시는 서버가 주소에서 정한다
 */
export function setPhotoLocation(photoId: string, place: Place) {
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
  return request<void>(`/photos/${photoId}/location`, { method: 'DELETE' })
}
