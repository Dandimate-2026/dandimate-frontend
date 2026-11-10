import { useAppNavigate } from '../hooks/useAppNavigate'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getMyRecordMap, cityMarkerPosition, samePlace, type CityPin, type MapPlaceItem } from '../api/recordMap'
import type { FlowerCode } from '../api/types'
import { getMyRooms } from '../api/rooms'
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
import { getReviewerDemo } from '../api/reviewerDemo'
import { syncChatScope } from '../lib/chatStore'

// Illustration anchors are navigation targets, not geographic coordinates.
const CITY_ANCHORS: Record<string, [number, number]> = {
  대구: [320,655], 경산: [421,670], 영천: [436,565], 청도: [445,733], 경주: [600,674], 포항: [595,515],
  영덕: [620,360], 울진: [620,170], 울릉: [716,144], 봉화: [480,150], 영양: [550,280], 청송: [530,390],
  안동: [420,300], 영주: [330,180], 예천: [300,310], 문경: [170,280], 상주: [150,410], 의성: [375,410],
  구미: [270,500], 군위: [370,515], 김천: [175,560], 성주: [230,615], 고령: [260,700], 칠곡: [310,565],
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
      label: '두루마리 보기',
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
            {uploader && ` · ${own ? '내가 올렸어요' : `${uploader.nickname} 님이 올렸어요`}`}
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

function CitySheet({ pin, place: focus, onClose, onChanged, onMap }: { pin: CityPin; place?: MapPlaceItem; onClose: () => void; onChanged: (message: string) => void; onMap: (pin: CityPin, place?: MapPlaceItem) => void }) {
  const [photoPage, setPhotoPage] = useState(1)
  const [expandedSummary, setExpandedSummary] = useState(false)
  const placeName = focus?.placeName
  // 세부 장소를 눌러 열었으면 그 장소에서 찍은 사진만 (AI 요약은 도시 단위라 보여주지 않는다)
  const places = focus ? pin.places.filter((p) => samePlace(p, focus)) : pin.places
  const navigate = useAppNavigate()
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
        <h2 id="city-sheet-title" className="mt-5 flex flex-wrap items-baseline gap-2">
          <span className="min-w-0 text-[22px] font-bold leading-8 [overflow-wrap:anywhere]">📍 {placeName ?? pin.city}</span>
          <span className="shrink-0 text-[12px] text-sub">
            {placeName
              ? `${pin.city} · 사진 ${places.length}장`
              : `사진 ${pin.photoCount}장 · 이야기 ${pin.recordCount}개 · 모임방 ${pin.rooms.length}개`}
          </span>
        </h2>

        <button type="button" onClick={() => onMap(pin, focus)} className="mt-4 min-h-11 w-full rounded-full bg-ink px-4 text-[13px] font-semibold text-surface">{placeName ? '이 장소를 실제 지도에서 보기' : `${pin.city} 실제 지도에서 보기`}</button>
        {!placeName && (
          <>
        {/* AI 한 줄 요약은 서버가 두루마리를 엮은 뒤에 만든다. 아직이면 언제 생기는지 알려 준다 */}
        <section className="mt-4 rounded-[20px] bg-[#fbe9f0] px-4 py-4">
          <p className="text-[12px] font-semibold text-point">✦ AI가 기억하는 {pin.city}</p>
          {pin.summary ? (
            <><p className={`mt-2 text-[15px] leading-7 font-semibold ${expandedSummary ? '' : 'line-clamp-3'}`}>“{pin.summary}”</p>{pin.summary.length > 90 && <button type="button" aria-expanded={expandedSummary} onClick={() => setExpandedSummary(value => !value)} className="mt-2 min-h-11 text-[12px] font-semibold text-point">{expandedSummary ? '요약 접기' : '요약 전체 보기'}</button>}</>
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
              {places.slice((photoPage - 1) * 4, photoPage * 4).map((place) => {
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
                    <button type="button" onClick={() => onMap(pin, place)} className="min-h-11 w-full text-right text-[12px] font-semibold text-point">{place.placeName} 지도에서 보기 ›</button>
                  </li>
                )
              })}
            </ul>
            {places.length > 4 && <nav aria-label="지도 사진 페이지" className="mt-4 flex items-center justify-between gap-2"><button type="button" disabled={photoPage === 1} onClick={() => setPhotoPage(value => value - 1)} className="min-h-11 px-3 text-[12px] disabled:opacity-35">이전</button><span className="text-[12px] text-sub" aria-live="polite">{photoPage} / {Math.ceil(places.length / 4)}</span><button type="button" disabled={photoPage >= Math.ceil(places.length / 4)} onClick={() => setPhotoPage(value => value + 1)} className="min-h-11 px-3 text-[12px] disabled:opacity-35">다음</button></nav>}
          </section>
        )}
      </div>
    </div>
  )
}


function CityOverview({ pins, activeCity, onOpenCity, onZoom, children }: { pins: CityPin[]; activeCity?: string; onOpenCity: (pin: CityPin) => void; onZoom: (pin?: CityPin) => void; children?: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null)
  const zoomAt = (clientX: number, clientY: number) => {
    const box = surface.current?.getBoundingClientRect()
    if (!box) return
    const x = (clientX - box.left) / box.width * 840, y = (clientY - box.top) / box.height * 860
    const nearest = pins.filter(pin => CITY_ANCHORS[pin.city]).reduce<CityPin | undefined>((best, pin) => {
      const distance = (item: CityPin) => Math.hypot(CITY_ANCHORS[item.city][0] - x, CITY_ANCHORS[item.city][1] - y)
      return !best || distance(pin) < distance(best) ? pin : best
    }, undefined)
    onZoom(nearest)
  }
  useEffect(() => {
    const element = surface.current
    if (!element) return
    let startDistance = 0
    const distance = (event: TouchEvent) => Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY)
    const start = (event: TouchEvent) => { startDistance = event.touches.length === 2 ? distance(event) : 0 }
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !startDistance) return
      event.preventDefault()
      if (distance(event) > startDistance * 1.12) {
        startDistance = 0
        zoomAt((event.touches[0].clientX + event.touches[1].clientX) / 2, (event.touches[0].clientY + event.touches[1].clientY) / 2)
      }
    }
    const wheel = (event: WheelEvent) => { if (event.deltaY < 0) { event.preventDefault(); zoomAt(event.clientX, event.clientY) } }
    element.addEventListener('touchstart', start, { passive: true })
    element.addEventListener('touchmove', move, { passive: false })
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move); element.removeEventListener('wheel', wheel) }
  })
  return <section aria-label="도시별 추억 지도" className="mx-3 mt-4">
    <div ref={surface} onDoubleClick={event => zoomAt(event.clientX, event.clientY)} style={{ touchAction: 'pan-y' }} className="relative aspect-[840/860] overflow-hidden rounded-[20px]">
      <img src={recordMapImage} alt="대구·경북 도시별 추억 안내 그림" draggable={false} className="absolute inset-0 size-full select-none" />
      {pins.map(pin => {
        const point = CITY_ANCHORS[pin.city]
        if (!point) return null
        return <button key={pin.city} type="button" onClick={() => onOpenCity(pin)} aria-label={`${pin.city} 기록 ${pin.recordCount}개`} aria-pressed={activeCity === pin.city} style={{ left: `${point[0] / 840 * 100}%`, top: `${point[1] / 860 * 100}%` }} className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"><span className="rounded-full bg-surface p-1 shadow-sm"><Flower code={cityFlower(pin.city)} size={22} /></span><span className="rounded-full bg-surface/95 px-2 text-[11px] font-bold whitespace-nowrap">{pin.city}</span><span className="h-2 w-0.5 bg-point" aria-hidden="true" /><span className="size-2 rounded-full bg-point ring-2 ring-surface" aria-hidden="true" /></button>
      })}
      {children}
      <button type="button" aria-label="확대하여 카카오맵 보기" onClick={() => onZoom(pins.find(pin => pin.city === activeCity) ?? pins[0])} className="absolute right-2 bottom-2 flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-[24px] shadow-sm">＋</button>
    </div>

  </section>
}


const ALL_ROOMS = 'all'

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
  onCreate,
}: {
  rooms: { roomId: string; name: string }[]
  value: string
  onChange: (roomId: string) => void
  onCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const label = value === ALL_ROOMS ? '전체 모임방' : (rooms.find((r) => r.roomId === value)?.name ?? '전체 모임방')
  const [query, setQuery] = useState('')
  const options = [{ roomId: ALL_ROOMS, name: '전체 모임방' }, ...rooms].filter((room) => room.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return (
    <div className="relative mt-2.5 inline-block max-w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold shadow-[0_2px_10px_rgba(42,38,35,0.06)]"
      >
        <span className="min-w-0 truncate" title={label}>{label}</span>
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
          className={`shrink-0 text-sub transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1.5 w-[min(280px,calc(100vw-64px))] rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(42,38,35,0.12)]">
          {rooms.length > 6 && <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="지도 모임방 검색" placeholder="모임방 이름 검색" className="mb-1 w-full rounded-xl bg-bg px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-line" />}
          <ul role="listbox" aria-label="지도 모임방 선택" className="max-h-56 overflow-y-auto">
          {options.map((o) => (
            <li key={o.roomId} role="option" aria-selected={o.roomId === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.roomId)
                  setOpen(false)
                }}
                className={`w-full rounded-[12px] px-3 py-2 text-left text-[13px] leading-5 [overflow-wrap:anywhere] ${
                  o.roomId === value ? 'bg-point/15 font-semibold text-point' : ''
                }`}
              >
                {o.name}
              </button>
            </li>
          ))}
          </ul>
          <button type="button" onClick={() => { setOpen(false); onCreate() }} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl border-t border-line px-3 text-left text-[13px] font-semibold text-point"><span aria-hidden="true">＋</span> 새 모임방 만들기</button>
          {options.length === 0 && <p className="px-3 py-3 text-[12px] text-sub">일치하는 모임방이 없어요.</p>}
        </div>
      )}
    </div>
  )
}

/** 아래 탭 "기록 지도": 내 사진 장소를 도시별 꽃 핀으로 보여준다. 방을 고르면 그 방 사진의 장소만 보인다 */
function RecordMapPage() {
  const navigate = useAppNavigate()
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
  // 도시·장소를 선택한 경우에만 그 실제 좌표로 상세 지도를 연다.
  const [detailCenter, setDetailCenter] = useState<{ lat: number; lng: number; city: string; level: number } | null>(null)
  const showRealMap = (pin: CityPin, place?: MapPlaceItem) => {
    const position = place ?? cityMarkerPosition(pin)
    const latitude = position.latitude, longitude = position.longitude
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setNotice('이 장소의 위치를 확인하지 못했어요. 장소를 다시 선택해 주세요.'); return }
    setDetailCenter({ lat: latitude, lng: longitude, city: pin.city, level: place ? 4 : 8 })
    setOpenCity(null); setOpenPlace(undefined)
  }
  const pins = visiblePins
  const [roomOptions, setRoomOptions] = useState<{ roomId: string; name: string }[] | null>(null)

  useEffect(() => {
    let sequence = 0
    const load = () => {
      const current = ++sequence
      void getReviewerDemo().then((demo) => {
        if (current !== sequence) return
        syncChatScope(demo.enabled ? demo.hostRoomId ?? 'REAL' : 'REAL')
        return Promise.all([getMyRecordMap(), getMyRooms().catch(() => undefined)])
      }).then((next) => {
        if (!next || current !== sequence) return
        setOpenCity(null); setOpenPlace(undefined); setRoomId(ALL_ROOMS); setDetailCenter(null)
        const [mapPins, joinedRooms] = next
        setRoomOptions(joinedRooms === undefined ? null : joinedRooms?.map(room => ({ roomId: room.roomId, name: room.name })) ?? [...new Map(mapPins.flatMap(pin => pin.rooms).map(room => [room.roomId, { roomId: room.roomId, name: room.name }])).values()])
        setPins(mapPins); setVisiblePins(mapPins); setError(false)
      }).catch(() => { if (current === sequence) { setPins(null); setVisiblePins(null); setOpenCity(null); setError(true) } })
    }
    load()
    const visible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', visible)
    return () => { sequence++; document.removeEventListener('visibilitychange', visible) }
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
            rooms={roomOptions ?? []}
            value={roomId}
            onChange={changeRoom}
            onCreate={() => navigate(paths.roomCreate())}
          />
        </div>
        {roomOptions?.length === 0 && <button type="button" onClick={() => navigate(paths.roomCreate())} className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-surface">＋ 첫 모임방 만들기</button>}
        {roomOptions?.length === 0 && <p className="mt-2 text-[11px] text-sub">친구에게 초대 링크를 받았다면 그 링크로 들어오면 돼요.</p>}
      </header>

      {/* 그림은 도시 선택, 실제 지도는 선택한 도시·장소의 좌표 탐색. */}
      {detailCenter ? (
        <KakaoRecordMap
          key={`${detailCenter.city}:${detailCenter.lat}:${detailCenter.lng}`}
          pins={pins ?? []}
          activeCity={detailCenter.city}
          initialLevel={detailCenter.level}
          cityFlower={cityFlower}
          initialCenter={detailCenter}
          onOpenCity={openSheet}
          onOverview={() => setDetailCenter(null)}
          onFail={() => { setDetailCenter(null); setNotice('실제 지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }}
        />
      ) : (
        <CityOverview
          pins={pins ?? []}
          activeCity={openCity?.city}
          onOpenCity={openSheet}
          onZoom={pin => pin ? showRealMap(pin) : setDetailCenter({ lat: 36.2, lng: 128.6, city: '', level: 10 })}
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
        </CityOverview>
      )}

      <p className="mx-5 mt-4 mb-4 rounded-[18px] bg-surface px-5 py-3.5 text-[13px] text-sub">
        확대하면 카카오맵에서 사진을 남긴 장소의 핀을 볼 수 있어요.
      </p>

      {openCity && <CitySheet key={`${openCity.city}:${openPlace?.photoId ?? "all"}`} pin={openCity} place={openPlace} onClose={() => setOpenCity(null)} onChanged={reloadAfterChange} onMap={showRealMap} />}
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
