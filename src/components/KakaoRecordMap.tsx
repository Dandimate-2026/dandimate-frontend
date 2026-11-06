import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { groupPlaces, type CityPin, type MapPlaceItem } from '../api/recordMap'
import type { FlowerCode } from '../api/types'
import { DAEGU_GYEONGBUK_RINGS } from '../lib/daeguGyeongbukShape'
import Flower from './Flower'

// 카카오 지도 SDK (카카오톡 공유와 같은 JavaScript 키). 카카오 콘솔에서 "카카오맵" 사용 설정이 켜져 있어야 한다
const APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${APP_KEY ?? ''}`

/** 이 레벨 이하(더 가까이)로 확대하면 도시 핀 대신 사진별 세부 장소 핀을 보여준다 (카카오 레벨: 숫자가 작을수록 가까이) */
const DETAIL_LEVEL = 8
/** 대구·경북이 한눈에 들어오는 처음 위치·레벨 */
const START = { lat: 36.25, lng: 128.75, level: 11 }
/** 지도를 끌어도 대구·경북 밖으로 너무 나가지 않게 가운데 좌표를 이 범위로 묶는다 (울릉도·독도 포함) */
const BOUNDS = { minLat: 35.4, maxLat: 37.6, minLng: 127.7, maxLng: 131.95 }

interface LatLng {
  getLat: () => number
  getLng: () => number
}
interface KakaoMap {
  getLevel: () => number
  getCenter: () => LatLng
  setCenter: (latLng: LatLng) => void
  setMaxLevel: (level: number) => void
  relayout: () => void
}
interface KakaoOverlay {
  setMap: (map: KakaoMap | null) => void
}
interface KakaoMaps {
  load: (callback: () => void) => void
  LatLng: new (lat: number, lng: number) => LatLng
  Map: new (el: HTMLElement, options: { center: LatLng; level: number }) => KakaoMap
  Polygon: new (options: {
    map?: KakaoMap
    path: LatLng[][]
    strokeWeight?: number
    strokeColor?: string
    strokeOpacity?: number
    fillColor?: string
    fillOpacity?: number
    zIndex?: number
  }) => KakaoOverlay
  CustomOverlay: new (options: { position: LatLng; content: HTMLElement; yAnchor?: number; xAnchor?: number; zIndex?: number }) => KakaoOverlay
  event: { addListener: (target: KakaoMap, type: string, handler: () => void) => void }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

let loading: Promise<KakaoMaps> | null = null

/** 카카오 지도 SDK를 한 번만 불러온다 */
function loadKakaoMaps(): Promise<KakaoMaps> {
  if (!APP_KEY) return Promise.reject(new Error('카카오 키가 없어요'))
  loading ??= new Promise((resolve, reject) => {
    const ready = () => window.kakao!.maps.load(() => resolve(window.kakao!.maps))
    if (window.kakao?.maps) return ready()
    const script = document.createElement('script')
    script.src = SDK_URL
    script.onload = () => (window.kakao?.maps ? ready() : reject(new Error('카카오 지도를 쓸 수 없어요')))
    script.onerror = () => {
      loading = null
      reject(new Error('카카오 지도를 불러오지 못했어요'))
    }
    document.head.appendChild(script)
  })
  return loading
}


type Marker =
  | { key: string; kind: 'city'; pin: CityPin; el: HTMLElement }
  | { key: string; kind: 'place'; pin: CityPin; place: MapPlaceItem; count: number; el: HTMLElement }

/**
 * 카카오 지도 위 기록 지도. 멀리서는 도시 핀, 확대하면 사진마다 고른 세부 장소 핀.
 * 지도를 못 불러오면 onFail을 불러 그림 지도로 바꾸게 한다
 */
function KakaoRecordMap({
  pins,
  activeCity,
  cityFlower,
  onOpenCity,
  onFail,
  children,
}: {
  pins: CityPin[]
  activeCity?: string
  cityFlower: (city: string) => FlowerCode
  /** placeName이 있으면 확대해서 누른 세부 장소 하나만 보여준다 */
  onOpenCity: (pin: CityPin, place?: MapPlaceItem) => void
  onFail: () => void
  children?: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [maps, setMaps] = useState<KakaoMaps | null>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const [level, setLevel] = useState(START.level)
  const [markers, setMarkers] = useState<Marker[]>([])

  // 지도 만들기
  useEffect(() => {
    let cancelled = false
    loadKakaoMaps()
      .then((km) => {
        if (cancelled || !boxRef.current) return
        const map = new km.Map(boxRef.current, { center: new km.LatLng(START.lat, START.lng), level: START.level })
        map.setMaxLevel(12)
        km.event.addListener(map, 'zoom_changed', () => setLevel(map.getLevel()))
        // 대구·경북 밖으로 끌고 나가면 범위 안으로 되돌린다
        km.event.addListener(map, 'dragend', () => {
          const c = map.getCenter()
          const lat = Math.min(BOUNDS.maxLat, Math.max(BOUNDS.minLat, c.getLat()))
          const lng = Math.min(BOUNDS.maxLng, Math.max(BOUNDS.minLng, c.getLng()))
          if (lat !== c.getLat() || lng !== c.getLng()) map.setCenter(new km.LatLng(lat, lng))
        })
        // 대구·경북 밖은 바다색으로 덮어서 대구·경북만 보이게 한다 (큰 사각형에 대구·경북 모양으로 구멍을 낸다)
        const toPath = (ring: [number, number][]) => ring.map(([lat, lng]) => new km.LatLng(lat, lng))
        const world: [number, number][] = [
          [30, 120],
          [30, 140],
          [45, 140],
          [45, 120],
        ]
        new km.Polygon({
          map,
          path: [toPath(world), ...DAEGU_GYEONGBUK_RINGS.map(toPath)],
          strokeWeight: 2,
          strokeColor: '#c9bfb2',
          strokeOpacity: 1,
          fillColor: '#e9eeec',
          fillOpacity: 1,
          zIndex: 1,
        })
        mapRef.current = map
        setMaps(km)
      })
      .catch(() => {
        if (!cancelled) onFail()
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 핀 올리기: 레벨에 따라 도시 핀 / 세부 장소 핀
  useEffect(() => {
    const map = mapRef.current
    if (!maps || !map) return
    const detail = level <= DETAIL_LEVEL
    const next: Marker[] = detail
      ? pins.flatMap((pin) =>
          groupPlaces(pin.places).map(({ place, count }) => ({
            key: place.photoId,
            kind: 'place' as const,
            pin,
            place,
            count,
            el: document.createElement('div'),
          })),
        )
      : pins.map((pin) => ({ key: pin.city, kind: 'city' as const, pin, el: document.createElement('div') }))
    const overlays = next.map((m) => {
      const lat = m.kind === 'place' ? m.place.latitude : m.pin.latitude
      const lng = m.kind === 'place' ? m.place.longitude : m.pin.longitude
      const overlay = new maps.CustomOverlay({ position: new maps.LatLng(lat, lng), content: m.el, yAnchor: 1, zIndex: 3 })
      overlay.setMap(map)
      return overlay
    })
    setMarkers(next)
    return () => overlays.forEach((o) => o.setMap(null))
  }, [maps, pins, level])

  return (
    <div className="relative mx-3 mt-4">
      <div ref={boxRef} className="relative aspect-[840/860] overflow-hidden rounded-[20px] bg-[#e9eeec]">
        {children}
      </div>
      {!maps && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-sub">
          지도를 불러오고 있어요…
        </p>
      )}
      {maps && level > DETAIL_LEVEL && pins.some((p) => p.places.length > 0) && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-surface/90 px-2.5 py-1 text-[10px] text-sub">
          확대하면 다녀온 곳이 보여요
        </p>
      )}

      {/* 카카오 지도 위 핀은 React로 그려서 꽃 아이콘·스타일을 그대로 쓴다 */}
      {markers.map((m) =>
        createPortal(
          m.kind === 'city' ? (
            <button
              type="button"
              onClick={() => onOpenCity(m.pin)}
              aria-label={`${m.pin.city} 기록 ${m.pin.recordCount}개`}
              className="flex flex-col items-center"
            >
              <span
                className={`flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2 text-[14px] font-bold shadow-[0_3px_12px_rgba(42,38,35,0.18)] ${
                  activeCity === m.pin.city ? 'bg-ink text-surface' : 'bg-surface text-ink'
                }`}
              >
                <Flower code={cityFlower(m.pin.city)} size={20} />
                {m.pin.city}
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] text-surface ${
                    m.pin.bloomed ? 'bg-point' : 'bg-ink'
                  }`}
                >
                  {m.pin.recordCount}
                </span>
              </span>
              <span className="h-3 w-0.5 bg-ink" aria-hidden="true" />
              <span className="-mt-0.5 size-2 rounded-full bg-ink" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenCity(m.pin, m.place)}
              aria-label={`${m.place.placeName} (${m.pin.city})`}
              className="flex flex-col items-center"
            >
              <span className="flex max-w-[140px] items-center gap-1 rounded-full bg-surface py-0.5 pr-2 pl-1 text-[11px] font-semibold text-ink shadow-[0_2px_8px_rgba(42,38,35,0.2)]">
                <Flower code={(m.place.uploader?.flowerCode as FlowerCode | undefined) ?? cityFlower(m.pin.city)} size={14} />
                <span className="truncate">{m.place.placeName}</span>
                {m.count > 1 && <span className="shrink-0 text-point">{m.count}</span>}
              </span>
              <span className="mt-0.5 size-2 rounded-full bg-point ring-2 ring-surface" aria-hidden="true" />
            </button>
          ),
          m.el,
          m.key,
        ),
      )}
    </div>
  )
}

export default KakaoRecordMap
