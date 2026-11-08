import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { getMyRecordMap, groupPlaces, samePlace, type CityPin, type MapPlaceItem } from '../api/recordMap'
import type { FlowerCode } from '../api/types'
import { getMe } from '../lib/auth'
import recordMapImage from '../assets/record-map.webp'
import BottomTabs, { BOTTOM_TABS_SPACE } from '../components/BottomTabs'
import KakaoRecordMap from '../components/KakaoRecordMap'
import Flower from '../components/Flower'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import { useSheetDrag } from '../hooks/useSheetDrag'
import { ViewablePhoto } from '../components/PhotoViewer'
import MoreMenu from '../components/MoreMenu'
import PlaceSheet from '../components/PlaceSheet'
import { removePhotoLocation, setPhotoLocation, type Place } from '../api/places'
import { deletePhoto } from '../api/photos'

// 시안 지도 그림(840×860) 크기. 그림 속 도시 위치(안동·구미·대구·포항·경주)에 맞춰 좌표 → 픽셀 식을 구했다
const MAP_W = 840
const MAP_H = 860
// x = 376.4 × 경도 − 48060.7, y = −466.3 × 위도 + 17363.6 (그림 픽셀)
const toMapX = (lng: number) => 376.4 * lng - 48060.7
const toMapY = (lat: number) => -466.3 * lat + 17363.6
// 울릉도·독도 쪽 사진은 그림의 울릉도 자리에 둔다
const ULLEUNG = { x: 713, y: 142 }

/** 좌표를 지도 그림 안의 % 위치로 바꾼다 */
function project(lat: number, lng: number) {
  const point = lng > 130.3 ? ULLEUNG : { x: toMapX(lng), y: toMapY(lat) }
  const x = (point.x / MAP_W) * 100
  const y = (point.y / MAP_H) * 100
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) }
}

/** 커스텀 지도 그림의 픽셀 위치를 대략적인 실제 좌표로 되돌린다. 확대 시 카카오맵 중심을 이어 주는 용도다. */
function unproject(x: number, y: number) {
  return { lat: (17363.6 - y) / 466.3, lng: (x + 48060.7) / 376.4 }
}

const CITY_FLOWERS: FlowerCode[] = [
  'AZALEA',
  'FORSYTHIA',
  'FORGET_ME_NOT',
  'TEAL',
  'PURPLE',
  'CANOLA',
  'LILAC',
  'ROYAL_AZALEA',
]

/** 도시 이름으로 늘 같은 꽃을 고른다 */
function cityFlower(city: string): FlowerCode {
  let hash = 0
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CITY_FLOWERS[hash % CITY_FLOWERS.length]
}


/** 기록 지도 바텀시트의 사진 한 장: 사진·장소·방, 그리고 덧붙이기 또는 답가로 가는 버튼 */
function PlacePhotoCard({
  place,
  roomName,
  completed,
  myUserId,
  onGo,
  onChanged,
}: {
  place: MapPlaceItem
  roomName: string
  completed: boolean
  myUserId: string | null
  onGo: (path: string) => void
  /** 내 사진의 장소를 바꾸거나 지웠을 때 (지도를 다시 불러온다) */
  onChanged: (message: string) => void
}) {
  const canOpen = Boolean(getRoomSession(place.roomId))
  // 지도 응답에 사진·올린 사람·첫 한마디가 같이 온다
  const uploader = place.uploader
  const own = Boolean(myUserId && uploader?.userId === myUserId)
  const [placing, setPlacing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const changePlace = async (_name: string, next?: Place) => {
    if (!next || busy) return
    setBusy(true)
    setFailed(null)
    try {
      await setPhotoLocation(place.photoId, next)
      setPlacing(false)
      onChanged(`${next.placeName}(으)로 옮겼어요`)
    } catch {
      setFailed('장소를 바꾸지 못했어요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }
  const removePlace = async () => {
    if (busy) return
    setBusy(true)
    setFailed(null)
    try {
      await removePhotoLocation(place.photoId)
      onChanged('지도에서 뺐어요')
    } catch {
      setFailed('지도에서 빼지 못했어요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }
  const removePhoto = async () => {
    if (busy) return
    setBusy(true)
    setFailed(null)
    try {
      await deletePhoto(place.photoId)
      setConfirmDelete(false)
      onChanged('사진을 지웠어요')
    } catch {
      setFailed('사진을 지우지 못했어요. 다시 시도해 주세요')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  let action: { label: string; path: string } | null = null
  let note = ''
  if (!canOpen) note = '이 기기에서 들어간 방이 아니라 열 수 없어요'
  else if (completed)
    action = {
      label: '답가 남기기',
      path: paths.roomScrollReply(place.roomId, place.photoId),
    }
  else
    action = {
      label: '덧붙이기',
      path: paths.roomCirculation(place.roomId, place.photoId),
    }

  return (
    <div className="rounded-[18px] border border-line bg-surface p-3">
      <div className="flex gap-3">
        {/* 사진은 작은 썸네일로: 못 불러오면 빈 칸 */}
        {place.imageUrl ? (
          <ViewablePhoto
            src={place.imageUrl}
            alt={`${place.placeName}에서 찍은 사진`}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
            className="size-[72px] shrink-0 rounded-[12px] bg-[#efe9df] object-cover"
          />
        ) : (
          <span
            className="size-[72px] shrink-0 rounded-[12px] bg-gradient-to-br from-[#f2c9b8] to-[#8e6a86]"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-[15px] font-bold">📍 {place.placeName}</p>
            {/* 내 사진: 장소 바꾸기, 두루마리가 완성되기 전이면 사진 지우기 */}
            {own && (
              <span className="-mt-1 -mr-1 shrink-0">
                <MoreMenu
                  label="내 사진 메뉴"
                  items={[
                    { label: '장소 바꾸기', onSelect: () => setPlacing(true) },
                    { label: '지도에서 빼기', onSelect: () => void removePlace() },
                    ...(completed ? [] : [{ label: '사진 지우기', onSelect: () => setConfirmDelete(true), danger: true }]),
                  ]}
                />
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-sub">
            {uploader && <Flower code={uploader.flowerCode as FlowerCode} size={14} />}
            {roomName}
            {uploader && ` · ${own ? '내' : `${uploader.nickname}님`} 사진`}
            {completed && ' · 두루마리 완성'}
          </p>
          {place.firstEntrySnippet && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-[18px]">“{place.firstEntrySnippet}”</p>
          )}
        </div>
      </div>
      {/* 사진이 많아도 눈이 덜 피곤하게: 꽉 찬 분홍 버튼 대신 오른쪽 작은 글자 버튼 */}
      {action ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onGo(action.path)}
            className="flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-point active:bg-[#fbe9f0]"
          >
            {action.label}
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : (
        <p className="mt-2 text-right text-[11px] text-muted">{note}</p>
      )}
      {failed && <p className="mt-1 text-right text-[11px] text-point" role="alert">{failed}</p>}

      {placing && (
        <PlaceSheet
          title="이 사진은 어디에서 찍었나요?"
          recent={[]}
          onClose={() => !busy && setPlacing(false)}
          onSelect={(name, detail) => void changePlace(name, detail)}
        />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6" onClick={() => !busy && setConfirmDelete(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="map-delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] rounded-[24px] bg-surface p-5 text-ink">
            <h2 id="map-delete-title" className="text-[17px] font-bold">이 사진을 지울까요?</h2>
            <p className="mt-1.5 text-[13px] leading-5 text-sub">사진과 여기에 남긴 이야기가 모두 지워지고, 지도에서도 사라져요. 되돌릴 수 없어요.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="h-11 rounded-full border border-line text-[14px] font-semibold">
                그대로 두기
              </button>
              <button type="button" disabled={busy} onClick={() => void removePhoto()} className="h-11 rounded-full bg-point text-[14px] font-semibold text-surface">
                {busy ? '지우는 중…' : '지우기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CitySheet({ pin, place: focus, onClose, onChanged }: { pin: CityPin; place?: MapPlaceItem; onClose: () => void; onChanged: (message: string) => void }) {
  const placeName = focus?.placeName
  // 세부 장소를 눌러 열었으면 그 장소에서 찍은 사진만 (AI 요약은 도시 단위라 보여주지 않는다)
  const places = focus ? pin.places.filter((p) => samePlace(p, focus)) : pin.places
  const navigate = useNavigate()
  const sheetDrag = useSheetDrag(onClose)
  // 내 사진에는 덧붙이기 대신 안내를 보여주려고 내 계정 id를 알아 둔다
  const [myUserId, setMyUserId] = useState<string | null>(null)
  useEffect(() => {
    getMe()
      .then((me) => setMyUserId(me?.id ?? null))
      .catch(() => {})
  }, [])
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/25" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={sheetDrag.sheetStyle}
        className="mx-auto max-h-[75dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-8 text-ink"
      >
        <div {...sheetDrag.handleProps} className="-my-2 flex w-full justify-center py-2" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-line" />
        </div>
        <h2 id="city-sheet-title" className="mt-5 flex items-baseline gap-2">
          <span className="text-[24px] font-bold">📍 {placeName ?? pin.city}</span>
          <span className="text-[13px] text-sub">
            {placeName
              ? `${pin.city} · 사진 ${places.length}장`
              : `기록 ${pin.recordCount}개 · 모임방 ${pin.rooms.length}개`}
          </span>
        </h2>

        {!placeName && (
          <>
        {/* AI 한 줄 요약은 서버가 두루마리를 엮은 뒤에 만든다. 아직이면 언제 생기는지 알려 준다 */}
        <section className="mt-4 rounded-[20px] bg-[#fbe9f0] px-4 py-4">
          <p className="text-[12px] font-semibold text-point">✦ AI가 기억하는 {pin.city}</p>
          {pin.summary ? (
            <p className="mt-2 text-[16px] leading-7 font-bold">“{pin.summary}”</p>
          ) : pin.summaryStatus === 'GENERATING' ? (
            <p className="mt-2 text-[14px] leading-6 text-sub">AI가 이 지역의 추억을 한 줄로 정리하고 있어요</p>
          ) : pin.summaryStatus === 'FAILED' ? (
            <p className="mt-2 text-[14px] leading-6 text-sub">요약을 만들지 못했어요. 잠시 후 다시 확인해 주세요</p>
          ) : (
            <p className="mt-2 text-[14px] leading-6 text-sub">
              아직 요약이 없어요. 이 방의 두루마리가 완성되면
              <br />
              AI가 {pin.city}의 추억을 한 줄로 남겨 줘요
            </p>
          )}
        </section>
          </>
        )}

        {/* 이 도시에서 찍은 사진마다: 장소·방·사진, 그리고 덧붙이기(진행 중) 또는 답가(완성)로 바로 간다 */}
        {places.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[13px] font-semibold text-sub">
              {placeName ? `${placeName}에서 찍은 사진` : `${pin.city}에서 찍은 사진`}
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {places.map((place) => {
                const room = pin.rooms.find((r) => r.roomId === place.roomId)
                return (
                  <li key={place.photoId}>
                    <PlacePhotoCard
                      place={place}
                      roomName={room?.name ?? '모임방'}
                      completed={room?.status === 'GROWING'}
                      myUserId={myUserId}
                      onGo={(path) => navigate(path)}
                      onChanged={onChanged}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}


/** 이 배율 이상으로 확대하면 도시 핀 대신 사진별 세부 장소 핀을 보여준다 */
const DETAIL_SCALE = 2
const MAX_SCALE = 5

/**
 * 확대·이동되는 지도. 두 손가락(또는 휠·+/- 버튼)으로 확대하고 한 손가락으로 끌어 옮긴다.
 * 핀은 확대해도 크기가 그대로이고, 위치만 지도를 따라간다
 */
function ZoomableMap({
  pins,
  activeCity,
  onOpenCity,
  onEnterDetail,
  children,
}: {
  pins: CityPin[]
  activeCity?: string
  /** placeName이 있으면 확대해서 누른 세부 장소 하나만 보여준다 */
  onOpenCity: (pin: CityPin, place?: MapPlaceItem) => void
  /** 충분히 확대한 시점에 실제 좌표 기반 카카오 상세 지도로 전환한다 */
  onEnterDetail: (center: { lat: number; lng: number }) => void
  children?: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const sizeRef = useRef(size)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ dist: 0, moved: 0 })
  const detailEntered = useRef(false)

  // 지도 상자 크기를 재 둔다 (핀 위치 계산용)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const next = { w: entry.contentRect.width, h: entry.contentRect.height }
      sizeRef.current = next
      setSize(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 지도가 상자 밖으로 빠져나가 빈 곳이 보이지 않게 맞춘다
  const clamp = (v: { s: number; x: number; y: number }) => {
    const { w, h } = sizeRef.current
    const s = Math.min(MAX_SCALE, Math.max(1, v.s))
    return { s, x: Math.min(0, Math.max(w - w * s, v.x)), y: Math.min(0, Math.max(h - h * s, v.y)) }
  }
  const zoomAt = (factor: number, cx: number, cy: number) =>
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(1, v.s * factor))
      const k = s / v.s
      return clamp({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k })
    })
  const zoomRef = useRef(zoomAt)
  useEffect(() => {
    zoomRef.current = zoomAt
  })

  // 휠 확대: 페이지가 같이 스크롤되지 않게 passive가 아닌 리스너로 막는다
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomRef.current(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const local = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pointers.current.size === 0) gesture.current = { dist: 0, moved: 0 }
    pointers.current.set(e.pointerId, local(e))
    gesture.current.dist = 0
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const now = local(e)
    pointers.current.set(e.pointerId, now)
    const pts = [...pointers.current.values()]
    if (pts.length === 1) {
      // 한 손가락: 끌어서 옮기기
      const dx = now.x - prev.x
      const dy = now.y - prev.y
      gesture.current.moved += Math.abs(dx) + Math.abs(dy)
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }))
    } else if (pts.length === 2) {
      // 두 손가락: 벌리면 확대, 오므리면 축소
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.dist) zoomAt(dist / gesture.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2)
      gesture.current.dist = dist
      gesture.current.moved += 10
    }
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    gesture.current.dist = 0
  }

  // 지도 그림 위 % 위치 → 지금 확대·이동 상태의 화면 위치(px)
  const toScreen = (lat: number, lng: number) => {
    const { x, y } = project(lat, lng)
    return { left: (x / 100) * size.w * view.s + view.x, top: (y / 100) * size.h * view.s + view.y }
  }
  const detail = view.s >= DETAIL_SCALE
  const places = detail ? pins.flatMap((pin) => groupPlaces(pin.places).map((g) => ({ pin, ...g }))) : []

  useEffect(() => {
    if (view.s < DETAIL_SCALE) {
      detailEntered.current = false
      return
    }
    if (detailEntered.current || size.w === 0 || size.h === 0) return
    detailEntered.current = true
    const imageX = (-view.x + size.w / 2) / view.s
    const imageY = (-view.y + size.h / 2) / view.s
    const viewportCenter = unproject(imageX * (MAP_W / size.w), imageY * (MAP_H / size.h))

    // 상세 지도는 빈 지도의 중심이 아니라, 지금 보고 있던 꽃 핀을 중심으로 연다.
    // 선택한 도시가 있으면 그것을 우선하고, 아니면 화면 중앙에 가장 가까운 도시를 고른다.
    const target =
      pins.find((pin) => pin.city === activeCity) ??
      pins.reduce<CityPin | null>((closest, pin) => {
        if (!closest) return pin
        const distance = (pin.latitude - viewportCenter.lat) ** 2 + (pin.longitude - viewportCenter.lng) ** 2
        const closestDistance =
          (closest.latitude - viewportCenter.lat) ** 2 + (closest.longitude - viewportCenter.lng) ** 2
        return distance < closestDistance ? pin : closest
      }, null)

    onEnterDetail(target ? { lat: target.latitude, lng: target.longitude } : viewportCenter)
  }, [activeCity, onEnterDetail, pins, size.h, size.w, view.s, view.x, view.y])

  return (
    <div className="relative mx-3 mt-4">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // 끌어서 옮긴 뒤 손을 뗄 때 핀이 눌리지 않게 막는다
        onClickCapture={(e) => {
          if (gesture.current.moved > 6) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        className="relative aspect-[840/860] touch-none overflow-hidden rounded-[20px] select-none"
      >
        <img
          src={recordMapImage}
          alt=""
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0' }}
          className="absolute inset-0 size-full"
        />

        {/* 멀리서: 도시 핀 */}
        {!detail &&
          pins.map((pin) => {
            const pos = toScreen(pin.latitude, pin.longitude)
            const active = activeCity === pin.city
            return (
              <button
                key={pin.city}
                type="button"
                onClick={() => onOpenCity(pin)}
                aria-label={`${pin.city} 기록 ${pin.recordCount}개`}
                style={pos}
                // 점(높이 8px)의 가운데가 도시 자리에 오도록 아래로 4px 내린다
                className="absolute flex w-max -translate-x-1/2 translate-y-[calc(-100%+4px)] flex-col items-center"
              >
                <span
                  className={`flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2 text-[14px] font-bold whitespace-nowrap shadow-[0_3px_12px_rgba(42,38,35,0.12)] ${
                    active ? 'bg-ink text-surface' : 'bg-surface'
                  }`}
                >
                  <Flower code={cityFlower(pin.city)} size={20} />
                  {pin.city}
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] ${
                      pin.bloomed ? 'bg-point text-surface' : 'bg-ink text-surface'
                    }`}
                  >
                    {pin.recordCount}
                  </span>
                </span>
                <span className="h-3 w-0.5 bg-ink" aria-hidden="true" />
                <span className="-mt-0.5 size-2 rounded-full bg-ink" aria-hidden="true" />
              </button>
            )
          })}

        {/* 확대했을 때: 사진마다 검색으로 고른 세부 장소 핀 */}
        {places.map(({ pin, place, count }) => {
          const pos = toScreen(place.latitude, place.longitude)
          return (
            <button
              key={place.photoId}
              type="button"
              onClick={() => onOpenCity(pin, place)}
              aria-label={`${place.placeName} (${pin.city})`}
              style={pos}
              className="absolute flex w-max -translate-x-1/2 -translate-y-full flex-col items-center"
            >
              <span className="flex max-w-[120px] items-center gap-1 rounded-full bg-surface py-0.5 pr-2 pl-1 text-[11px] font-semibold shadow-[0_2px_8px_rgba(42,38,35,0.15)]">
                <Flower code={(place.uploader?.flowerCode as FlowerCode | undefined) ?? cityFlower(pin.city)} size={14} />
                <span className="truncate">{place.placeName}</span>
                {count > 1 && <span className="shrink-0 text-point">{count}</span>}
              </span>
              <span className="mt-0.5 size-1.5 rounded-full bg-point ring-2 ring-surface" aria-hidden="true" />
            </button>
          )
        })}

        {children}
      </div>

      {/* 확대·축소 버튼 (마우스로도 쓸 수 있게) */}
      <div className="absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-sm">
        <button
          type="button"
          aria-label="확대"
          onClick={() => zoomAt(1.6, size.w / 2, size.h / 2)}
          className="size-9 text-[18px] active:bg-bg"
        >
          +
        </button>
        <button
          type="button"
          aria-label="축소"
          onClick={() => zoomAt(1 / 1.6, size.w / 2, size.h / 2)}
          className="size-9 border-t border-line text-[18px] active:bg-bg"
        >
          −
        </button>
      </div>
      {view.s > 1 && (
        <button
          type="button"
          onClick={() => setView({ s: 1, x: 0, y: 0 })}
          className="absolute top-2 right-2 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold shadow-sm active:opacity-80"
        >
          전체 보기
        </button>
      )}
      {!detail && pins.some((p) => p.places.length > 0) && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[10px] text-sub">
          확대하면 다녀온 곳이 보여요
        </p>
      )}
    </div>
  )
}

const ALL_ROOMS = 'all'

/** 고른 방의 사진 장소만 남긴 도시 핀. 전체면 그대로 */
function filterPins(pins: CityPin[], roomId: string): CityPin[] {
  if (roomId === ALL_ROOMS) return pins
  return pins
    .map((pin) => {
      const rooms = pin.rooms.filter((r) => r.roomId === roomId)
      const places = pin.places.filter((p) => p.roomId === roomId)
      return {
        ...pin,
        rooms,
        places,
        photoCount: places.length,
        recordCount: rooms.reduce((sum, r) => sum + r.recordCount, 0),
        bloomed: rooms.some((r) => r.scrollReady),
        summary: rooms.find((r) => r.summary)?.summary ?? null,
      }
    })
    .filter((pin) => pin.places.length > 0 || pin.rooms.length > 0)
}

/** 지도 위 방 고르기: 펼치면 내 방들과 전체 모임방 */
function RoomFilter({
  rooms,
  value,
  onChange,
}: {
  rooms: { roomId: string; name: string }[]
  value: string
  onChange: (roomId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const label = value === ALL_ROOMS ? '전체 모임방' : (rooms.find((r) => r.roomId === value)?.name ?? '전체 모임방')
  const options = [{ roomId: ALL_ROOMS, name: '전체 모임방' }, ...rooms]
  return (
    <div className="relative mt-2.5 inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold shadow-[0_2px_10px_rgba(42,38,35,0.06)]"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`text-sub transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1.5 max-h-64 min-w-[180px] overflow-y-auto rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(42,38,35,0.12)]"
        >
          {options.map((o) => (
            <li key={o.roomId} role="option" aria-selected={o.roomId === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.roomId)
                  setOpen(false)
                }}
                className={`w-full truncate rounded-[12px] px-3 py-2 text-left text-[13px] ${
                  o.roomId === value ? 'bg-point/15 font-semibold text-point' : ''
                }`}
              >
                {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 아래 탭 "기록 지도": 내 사진 장소를 도시별 꽃 핀으로 보여준다. 방을 고르면 그 방 사진의 장소만 보인다 */
function RecordMapPage() {
  const [allPins, setPins] = useState<CityPin[] | null>(null)
  const [visiblePins, setVisiblePins] = useState<CityPin[] | null>(null)
  const [error, setError] = useState(false)
  const [openCity, setOpenCity] = useState<CityPin | null>(null)
  // 확대해서 세부 장소 핀을 눌렀으면 그 장소 이름 (그 장소 사진만 보여준다)
  const [openPlace, setOpenPlace] = useState<MapPlaceItem | undefined>()
  const openSheet = (pin: CityPin, place?: MapPlaceItem) => {
    setOpenCity(pin)
    setOpenPlace(place)
  }
  const [roomId, setRoomId] = useState(ALL_ROOMS)
  // 개요에서는 커스텀 행정구역 지도를, 충분히 확대하면 이 좌표를 중심으로 카카오 상세 지도를 보여 준다.
  const [detailCenter, setDetailCenter] = useState<{ lat: number; lng: number } | null>(null)
  const pins = visiblePins
  // 지도에 장소가 있는 방들 (방 고르기 목록)
  const roomOptions = allPins
    ? [...new Map(allPins.flatMap((p) => p.rooms).map((r) => [r.roomId, { roomId: r.roomId, name: r.name }])).values()]
    : []

  useEffect(() => {
    getMyRecordMap()
      .then((next) => { setPins(next); setVisiblePins(next) })
      .catch(() => setError(true))
  }, [])

  // 내 사진의 장소를 바꾸거나 지우면 시트를 닫고 지도를 다시 불러온다
  const [notice, setNotice] = useState<string | null>(null)
  const reloadAfterChange = (message: string) => {
    setOpenCity(null)
    setNotice(message)
    window.setTimeout(() => setNotice(null), 3000)
    getMyRecordMap()
      .then((next) => {
        setPins(next)
        if (roomId === ALL_ROOMS) setVisiblePins(next)
        else return getMyRecordMap(roomId).then(setVisiblePins)
      })
      .catch(() => setError(true))
  }

  const changeRoom = (next: string) => {
    setRoomId(next)
    setOpenCity(null)
    setDetailCenter(null)
    setError(false)
    if (next === ALL_ROOMS) {
      setVisiblePins(allPins)
      return
    }
    // 방 필터는 서버에도 똑같이 적용한다. 실패하면 이미 받은 전체 응답을 안전한 대체값으로 사용한다.
    getMyRecordMap(next)
      .then(setVisiblePins)
      .catch(() => {
        setVisiblePins(allPins ? filterPins(allPins, next) : [])
        setError(true)
      })
  }

  return (
    <main className={`relative flex min-h-dvh flex-col bg-[#e9eeec] text-ink ${BOTTOM_TABS_SPACE}`}>
      <header className="px-5 pt-[clamp(40px,8dvh,64px)]">
        <p className="inline-flex items-baseline gap-2 rounded-full bg-surface px-5 py-3 shadow-[0_2px_10px_rgba(42,38,35,0.06)]">
          <span className="text-[18px] font-bold">우리 기록 지도</span>
          <span className="text-[12px] text-sub">대구·경북 {pins?.length ?? 0}곳</span>
        </p>
        <div>
          <RoomFilter
            rooms={roomOptions}
            value={roomId}
            onChange={changeRoom}
          />
        </div>
      </header>

      {/* 개요는 시안의 커스텀 경계 지도, 확대하면 카카오 상세 지도. */}
      {detailCenter ? (
        <KakaoRecordMap
          pins={pins ?? []}
          activeCity={openCity?.city}
          cityFlower={cityFlower}
          initialCenter={detailCenter}
          onOpenCity={openSheet}
          onOverview={() => setDetailCenter(null)}
          onFail={() => setDetailCenter(null)}
        />
      ) : (
        <ZoomableMap
          pins={pins ?? []}
          activeCity={openCity?.city}
          onOpenCity={openSheet}
          onEnterDetail={setDetailCenter}
        >
          {pins?.length === 0 && (
            <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[13px] leading-6 text-sub">
              아직 지도에 핀 꽃이 없어요.
              <br />
              사진에 장소를 남기면 여기에 꽃이 피어요
            </p>
          )}
          {error && (
            <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[13px] text-sub">
              지도를 불러오지 못했어요. 잠시 후 다시 열어 주세요
            </p>
          )}
        </ZoomableMap>
      )}

      <p className="mx-5 mt-4 mb-4 rounded-[18px] bg-surface px-5 py-3.5 text-[13px] text-sub">
        도시를 누르면 AI가 그곳의 추억을 한 줄로 들려줘요
      </p>

      {openCity && <CitySheet pin={openCity} place={openPlace} onClose={() => setOpenCity(null)} onChanged={reloadAfterChange} />}
      {notice && (
        <p role="status" className="fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-[13px] text-surface">
          {notice}
        </p>
      )}
      <BottomTabs />
    </main>
  )
}

export default RecordMapPage
