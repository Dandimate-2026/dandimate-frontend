import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getMyRecordMap, type CityPin } from '../api/recordMap'
import type { FlowerCode } from '../api/types'
import BottomTabs, { BOTTOM_TABS_SPACE } from '../components/BottomTabs'
import Flower from '../components/Flower'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

// 대구·경북이 들어오는 범위 (경도·위도). 울릉도는 오른쪽 끝에 붙여 보여준다
const LNG_MIN = 127.8
const LNG_MAX = 129.7
const LAT_MIN = 35.55
const LAT_MAX = 37.15

/** 좌표를 지도 상자 안의 % 위치로 바꾼다 */
function project(lat: number, lng: number) {
  const x = ((Math.min(lng, LNG_MAX) - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100
  return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) }
}

const CITY_FLOWERS: FlowerCode[] = ['AZALEA', 'FORSYTHIA', 'FORGET_ME_NOT', 'TEAL', 'PURPLE', 'CANOLA', 'LILAC', 'ROYAL_AZALEA']

/** 도시 이름으로 늘 같은 꽃을 고른다 */
function cityFlower(city: string): FlowerCode {
  let hash = 0
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CITY_FLOWERS[hash % CITY_FLOWERS.length]
}

const STATUS_LABEL: Record<string, string> = {
  COLLECTING: '모으는 중',
  CIRCULATING: '돌려보는 중',
  WEAVING: '엮는 중',
  GROWING: '완성',
}

// 대구·경북 대략의 윤곽 (위 범위를 0~100으로 본 좌표)
const LAND_PATH =
  'M30 6 L52 3 L72 8 L86 4 L95 14 L93 34 L96 52 L93 70 L97 84 L88 96 L66 94 L48 98 L34 92 L22 96 L12 84 L16 70 L6 58 L12 44 L4 30 L14 18 Z'

function CitySheet({ pin, onClose }: { pin: CityPin; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/25" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[75dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-8 text-ink"
      >
        <span className="mx-auto block h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <h2 id="city-sheet-title" className="mt-5 flex items-baseline gap-2">
          <span className="text-[24px] font-bold">📍 {pin.city}</span>
          <span className="text-[13px] text-sub">
            기록 {pin.recordCount}개 · 모임방 {pin.rooms.length}개
          </span>
        </h2>

        {pin.summary && (
          <section className="mt-4 rounded-[20px] bg-[#fbe9f0] px-4 py-4">
            <p className="text-[12px] font-semibold text-point">✦ AI가 기억하는 {pin.city}</p>
            <p className="mt-2 text-[16px] leading-7 font-bold">“{pin.summary}”</p>
          </section>
        )}

        {pin.rooms.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[13px] font-semibold text-sub">{pin.city}에서 만든 모임방</h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {pin.rooms.map((room) => {
                // 이 기기에 입장 정보가 있는 방만 바로 열 수 있다
                const canOpen = Boolean(getRoomSession(room.roomId))
                return (
                  <li key={room.roomId}>
                    <button
                      type="button"
                      disabled={!canOpen}
                      onClick={() => navigate(paths.roomHome(room.roomId))}
                      className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left disabled:opacity-60"
                    >
                      <span className="size-14 shrink-0 rounded-[14px] bg-[#efe9df]" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{room.name}</span>
                        <span className="mt-1 block text-[12px] text-sub">
                          {room.meetingDate.replaceAll('-', '.')} · {STATUS_LABEL[room.status] ?? room.status} · 이야기{' '}
                          {room.recordCount}개
                        </span>
                      </span>
                      <span className="text-sub" aria-hidden="true">
                        ›
                      </span>
                    </button>
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

/** 아래 탭 "기록 지도": 내 사진 장소를 도시별 꽃 핀으로 보여준다 */
function RecordMapPage() {
  const [pins, setPins] = useState<CityPin[] | null>(null)
  const [error, setError] = useState(false)
  const [openCity, setOpenCity] = useState<CityPin | null>(null)

  useEffect(() => {
    getMyRecordMap()
      .then(setPins)
      .catch(() => setError(true))
  }, [])

  return (
    <main className={`relative flex min-h-dvh flex-col bg-[#e9eeec] text-ink ${BOTTOM_TABS_SPACE}`}>
      <header className="px-5 pt-[clamp(40px,8dvh,64px)]">
        <p className="inline-flex items-baseline gap-2 rounded-full bg-surface px-5 py-3 shadow-[0_2px_10px_rgba(42,38,35,0.06)]">
          <span className="text-[18px] font-bold">우리 기록 지도</span>
          <span className="text-[12px] text-sub">대구·경북 {pins?.length ?? 0}곳</span>
        </p>
      </header>

      <div className="relative mx-5 mt-6 aspect-[4/5] flex-1">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
          <path d={LAND_PATH} fill="#f3eee4" stroke="#ddd5c8" strokeWidth="0.4" />
        </svg>
        <span className="absolute top-[38%] right-0 text-[11px] text-[#9fb3b0]" aria-hidden="true">
          동해
        </span>

        {pins?.map((pin) => {
          const { x, y } = project(pin.latitude, pin.longitude)
          const active = openCity?.city === pin.city
          return (
            <button
              key={pin.city}
              type="button"
              onClick={() => setOpenCity(pin)}
              aria-label={`${pin.city} 기록 ${pin.recordCount}개`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            >
              <span
                className={`flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2 text-[14px] font-bold shadow-[0_3px_12px_rgba(42,38,35,0.12)] ${
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
            </button>
          )
        })}

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
      </div>

      <p className="mx-5 mt-4 mb-4 rounded-[18px] bg-surface px-5 py-3.5 text-[13px] text-sub">
        도시를 누르면 AI가 그곳의 추억을 한 줄로 들려줘요
      </p>

      {openCity && <CitySheet pin={openCity} onClose={() => setOpenCity(null)} />}
      <BottomTabs />
    </main>
  )
}

export default RecordMapPage
