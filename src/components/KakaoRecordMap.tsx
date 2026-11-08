import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cityMarkerPosition, groupPlaces, type CityPin, type MapPlaceItem } from '../api/recordMap'
import type { FlowerCode } from '../api/types'
import Flower from './Flower'

// 카카오 지도 SDK (카카오톡 공유와 같은 JavaScript 키). 카카오 콘솔에서 "카카오맵" 사용 설정이 켜져 있어야 한다
const APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${APP_KEY ?? ''}`

/** 이 레벨 이하(더 가까이)로 확대하면 도시 핀 대신 사진별 세부 장소 핀을 보여준다 (카카오 레벨: 숫자가 작을수록 가까이) */
const DETAIL_LEVEL = 8
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
  setLevel: (level: number, options?: { animate: boolean }) => void
  panTo: (latLng: LatLng) => void
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
  CustomOverlay: new (options: { position: LatLng; content: HTMLElement; yAnchor?: number; xAnchor?: number; zIndex?: number }) => KakaoOverlay
  event: { addListener: (target: KakaoMap, type: string, handler: () => void) => void; removeListener: (target: KakaoMap, type: string, handler: () => void) => void }
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
 * 커스텀 행정구역 지도를 충분히 확대한 뒤 보여 주는 카카오 상세 지도.
 * 실제 도로·지명·좌표는 이 단계에서만 보여 주고, 축소하면 다시 커스텀 지도로 돌아간다.
 */
function KakaoRecordMap({
  pins,
  activeCity,
  cityFlower,
  onOpenCity,
  onFail,
  onOverview,
  initialCenter,
  children,
}: {
  pins: CityPin[]
  activeCity?: string
  cityFlower: (city: string) => FlowerCode
  /** placeName이 있으면 확대해서 누른 세부 장소 하나만 보여준다 */
  onOpenCity: (pin: CityPin, place?: MapPlaceItem) => void
  onFail: () => void
  /** 충분히 축소하면 다시 행정구역 개요 지도로 보낸다 */
  onOverview: () => void
  initialCenter: { lat: number; lng: number }
  children?: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [maps, setMaps] = useState<KakaoMaps | null>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const [level, setLevel] = useState(DETAIL_LEVEL)
  const [markers, setMarkers] = useState<Marker[]>([])
  const detail = level <= DETAIL_LEVEL

  // 지도 만들기
  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}
    loadKakaoMaps()
      .then((km) => {
        if (cancelled || !boxRef.current) return
        const map = new km.Map(boxRef.current, { center: new km.LatLng(initialCenter.lat, initialCenter.lng), level: DETAIL_LEVEL })
        map.setMaxLevel(12)
        const onZoom = () => {
          const nextLevel = map.getLevel()
          setLevel(nextLevel)
        }
        const onIdle = () => { if (map.getLevel() >= 10) onOverview() }
        // 대구·경북 밖으로 끌고 나가면 범위 안으로 되돌린다
        const onDragEnd = () => {
          const c = map.getCenter()
          const lat = Math.min(BOUNDS.maxLat, Math.max(BOUNDS.minLat, c.getLat()))
          const lng = Math.min(BOUNDS.maxLng, Math.max(BOUNDS.minLng, c.getLng()))
          if (lat !== c.getLat() || lng !== c.getLng()) map.panTo(new km.LatLng(lat, lng))
        }
        km.event.addListener(map, 'zoom_changed', onZoom)
        km.event.addListener(map, 'idle', onIdle)
        km.event.addListener(map, 'dragend', onDragEnd)
        const observer = new ResizeObserver(() => map.relayout())
        observer.observe(boxRef.current)
        cleanup = () => {
          observer.disconnect()
          km.event.removeListener(map, 'zoom_changed', onZoom)
          km.event.removeListener(map, 'idle', onIdle)
          km.event.removeListener(map, 'dragend', onDragEnd)
          mapRef.current = null
        }
        mapRef.current = map
        setMaps(km)
      })
      .catch(() => {
        if (!cancelled) onFail()
      })
    return () => {
      cancelled = true
      cleanup()
    }
    // initialCenter는 커스텀 지도에서 카카오 상세 지도로 넘어오는 한 번의 위치값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 핀 올리기: 레벨에 따라 도시 핀 / 세부 장소 핀
  useEffect(() => {
    const map = mapRef.current
    if (!maps || !map) return
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
      const position = m.kind === 'place' ? m.place : cityMarkerPosition(m.pin)
      const lat = position.latitude
      const lng = position.longitude
      // 핀 내용은 React가 나중에 채워서, 카카오가 크기로 계산하는 기준점(yAnchor)이 어긋나 확대할 때 핀이 제자리를 벗어났다.
      // 기준점을 좌표 그 자리(0,0)로 두고, 핀을 CSS로 "가운데 아래 = 좌표"가 되게 직접 옮긴다
      m.el.style.transform = 'translate(-50%, -100%)'
      m.el.style.width = 'max-content'
      const overlay = new maps.CustomOverlay({ position: new maps.LatLng(lat, lng), content: m.el, xAnchor: 0, yAnchor: 0, zIndex: 3 })
      overlay.setMap(map)
      return overlay
    })
    setMarkers(next)
    return () => overlays.forEach((o) => o.setMap(null))
  }, [maps, pins, detail])

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
        <p className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-surface/90 px-2.5 py-1 text-[10px] text-sub">
          확대하면 다녀온 곳이 보여요
        </p>
      )}

      {maps && (
        <div className="absolute right-2 bottom-2 z-10 flex flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-sm">
          <button
            type="button"
            aria-label="확대"
            onClick={() => mapRef.current?.setLevel(Math.max(1, mapRef.current.getLevel() - 1), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })}
            className="size-9 text-[18px] active:bg-bg"
          >
            +
          </button>
          <button
            type="button"
            aria-label="축소"
            onClick={() => mapRef.current?.setLevel(Math.min(12, mapRef.current.getLevel() + 1), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })}
            className="size-9 border-t border-line text-[18px] active:bg-bg"
          >
            −
          </button>
        </div>
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
              <span className="flex max-w-[180px] items-center gap-1.5 rounded-full bg-surface py-1.5 pr-3 pl-2 text-[14px] font-bold text-ink shadow-[0_2px_8px_rgba(42,38,35,0.2)]">
                <Flower code={(m.place.uploader?.flowerCode as FlowerCode | undefined) ?? cityFlower(m.pin.city)} size={20} />
                <span className="truncate">{m.place.placeName}</span>
                {m.count > 1 && <span className="shrink-0 text-[13px] text-point">{m.count}</span>}
              </span>
              <span className="mt-1 size-3 rounded-full bg-point ring-2 ring-surface" aria-hidden="true" />
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
