import { useEffect, useState } from 'react'
import { searchPlaces, type Place } from '../api/places'
import Button from './Button'

const SEARCH_DELAY_MS = 300
const OTHER_REGION = '다른 지역'

const PLACE_GROUPS: { region: string; cities: string[] }[] = [
  { region: '대구', cities: ['대구'] },
  { region: '경북', cities: ['경주', '포항', '구미', '안동', '경산', '문경', '영주', '김천', '상주', '영천', '칠곡', '울릉'] },
  { region: '그 밖에', cities: [OTHER_REGION] },
]

/** 받침이 없거나 ㄹ 받침이면 '로', 그 밖의 받침이면 '으로' */
function withRo(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '로'
  const jong = code % 28
  return jong === 0 || jong === 8 ? '로' : '으로'
}

/** 검색 탭: 장소명·주소로 서버(카카오 장소 검색)에 물어본다 */
function PlaceSearch({
  initialQuery,
  selected,
  onPick,
}: {
  initialQuery: string
  selected: Place | null
  onPick: (place: Place) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Place[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) return
    let cancelled = false
    const timer = setTimeout(() => {
      setState('loading')
      searchPlaces(keyword)
        .then((list) => {
          if (cancelled) return
          setResults(list)
          setState('idle')
        })
        .catch(() => {
          if (!cancelled) setState('error')
        })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const keyword = query.trim()

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 장소나 주소 검색 (예: 황리단길)"
        aria-label="장소나 주소 검색"
        className="h-12 w-full rounded-full bg-bg px-5 text-[14px] outline-none placeholder:text-muted"
      />
      {!keyword ? (
        <p className="py-10 text-center text-[13px] text-sub">놀았던 곳 이름이나 주소를 적어 주세요</p>
      ) : state === 'error' ? (
        <p className="py-10 text-center text-[13px] text-sub">검색하지 못했어요. 잠시 후 다시 해 주세요</p>
      ) : state === 'loading' && results.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-sub">찾고 있어요…</p>
      ) : results.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-sub">찾는 곳이 없어요. 다른 이름으로 찾아보세요</p>
      ) : (
        <ul className="mt-2">
          {results.map((p) => {
            const active = selected?.placeName === p.placeName && selected.address === p.address
            return (
              <li key={`${p.placeName}-${p.address}`} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(p)}
                  className={`w-full px-1 py-3.5 text-left ${active ? 'text-point' : ''}`}
                >
                  <span className="block text-[15px] font-semibold">{p.placeName}</span>
                  <span className="mt-1 block text-[12px] text-sub">{p.address}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** 방 만들기의 "어디서 놀았나요?" 장소 선택 시트. 도시 목록에서 고르거나 장소를 검색한다 */
function PlaceSheet({
  initial,
  recent,
  onClose,
  onSelect,
}: {
  initial?: string
  recent: string[]
  onClose: () => void
  /** detail은 검색 탭에서 고른 경우에만 있다 */
  onSelect: (place: string, detail?: Place) => void
}) {
  // 목록에서 고른 도시 → 검색 탭에서 그 도시의 실제 장소(주소·좌표)를 고른다
  const [city, setCity] = useState(initial ?? '')
  const [picked, setPicked] = useState<Place | null>(null)
  const [tab, setTab] = useState<'list' | 'search'>('list')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const keyword = query.trim()
  const groups = PLACE_GROUPS.map((g) => ({ ...g, cities: g.cities.filter((c) => c.includes(keyword)) })).filter(
    (g) => g.cities.length > 0,
  )

  const chip = (name: string) => (
    <button
      key={name}
      type="button"
      onClick={() => {
        setCity(name)
        setPicked(null)
      }}
      aria-pressed={city === name}
      className={`h-11 rounded-[14px] border text-[14px] ${
        city === name ? 'border-ink bg-ink font-semibold text-surface' : 'border-line bg-surface'
      }`}
    >
      {name}
    </button>
  )

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/35" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-[28px] bg-surface px-5 pt-2.5 pb-6 text-ink"
      >
        <span className="mx-auto h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <h2 id="place-sheet-title" className="mt-4 text-[20px] font-bold">
          어디서 놀았나요?
        </h2>
        <p className="mt-1 text-[12px] text-sub">고른 장소는 기록 지도에 꽃으로 피어요</p>

        <div className="mt-4 grid grid-cols-2 rounded-[16px] bg-bg p-1 text-[14px]" role="tablist">
          {(['list', 'search'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-10 rounded-[12px] ${tab === t ? 'bg-surface font-semibold shadow-sm' : 'text-sub'}`}
            >
              {t === 'list' ? '목록' : '검색'}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {tab === 'search' ? (
            <PlaceSearch
              // 도시를 바꾸면 검색어를 그 도시로 다시 채운다
              key={city}
              initialQuery={city && city !== OTHER_REGION ? `${city} ` : ''}
              selected={picked}
              onPick={setPicked}
            />
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 도시 이름 검색"
                aria-label="도시 이름 검색"
                className="h-12 w-full rounded-full bg-bg px-5 text-[14px] outline-none placeholder:text-muted"
              />
              {recent.length > 0 && !keyword && (
                <div className="mt-4 flex items-center gap-2 text-[12px]">
                  <span className="text-sub">최근</span>
                  {recent.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setCity(name)
                        setPicked(null)
                      }}
                      className="rounded-full bg-point/15 px-3 py-1.5 font-semibold text-point"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {groups.map((g) => (
                <section key={g.region} className="mt-5">
                  <h3 className="text-[12px] font-semibold text-sub">{g.region}</h3>
                  <div className={`mt-2 grid gap-2 ${g.region === '그 밖에' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                    {g.cities.map(chip)}
                  </div>
                </section>
              ))}
              {groups.length === 0 && <p className="py-10 text-center text-[13px] text-sub">찾는 도시가 없어요</p>}
            </>
          )}
        </div>

        {tab === 'list' ? (
          <Button type="button" disabled={!city} onClick={() => setTab('search')} className="mt-4 w-full">
            {city ? (city === OTHER_REGION ? '다음 · 장소 찾기' : `다음 · ${city}에서 장소 찾기`) : '도시를 골라 주세요'}
          </Button>
        ) : (
          <>
            <Button type="button" disabled={!picked} onClick={() => picked && onSelect(picked.placeName, picked)} className="mt-4 w-full">
              {picked ? `${picked.placeName}${withRo(picked.placeName)} 정하기` : '장소를 골라 주세요'}
            </Button>
            {/* 장소가 검색되지 않거나 기억나지 않으면 도시까지만 정할 수 있다 */}
            {city && city !== OTHER_REGION && !picked && (
              <button type="button" onClick={() => onSelect(city)} className="mt-2.5 text-center text-[12px] text-sub underline">
                {city}{withRo(city)}만 정하기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PlaceSheet
