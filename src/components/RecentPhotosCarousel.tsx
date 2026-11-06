import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getCirculation } from '../api/memories'
import type { CirculationCard } from '../api/types'
import { paths } from '../routes/paths'
import Flower from './Flower'

/** 올린 시각을 "방금·N분 전·N시간 전·N일 전"으로 */
function timeAgo(iso: string | undefined) {
  if (!iso) return ''
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 5) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/** 이 사진에 대해 내가 할 일·상태 한 줄 */
function statusLine(card: CirculationCard): { text: string; todo: boolean } {
  const stories = card.otherEntries.length
  switch (card.myResponse.status) {
    case 'OWN_PHOTO':
      return { text: stories > 0 ? `친구 이야기 ${stories}개가 붙었어요` : '친구 이야기를 기다려요', todo: false }
    case 'ADDON':
      return { text: `덧붙였어요 · 이야기 ${stories}개`, todo: false }
    case 'PASSED':
      return { text: '패스했어요', todo: false }
    default:
      return { text: '이야기를 기다려요', todo: true }
  }
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  )
}

/**
 * 모임방 홈: 친구들이 올린 사진을 한 줄 카드로 보여주고, 여러 장이면 옆으로 넘긴다.
 * version이 바뀌면(홈을 다시 불러오면 = 실시간 이벤트가 오면) 같이 다시 불러온다
 */
function RecentPhotosCarousel({ roomId, token, version }: { roomId: string; token: string; version: unknown }) {
  const navigate = useNavigate()
  const [cards, setCards] = useState<CirculationCard[]>([])
  const [page, setPage] = useState(0)
  const trackRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let active = true
    getCirculation(roomId, token)
      .then((list) => {
        if (!active) return
        // 최근에 올라온 사진부터
        const sorted = [...list].sort((a, b) =>
          (b.firstEntry?.confirmedAt ?? '').localeCompare(a.firstEntry?.confirmedAt ?? ''),
        )
        setCards(sorted)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [roomId, token, version])

  if (cards.length === 0) return null

  const goTo = (index: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="mt-3" aria-label="친구들이 올린 사진">
      <ul
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setPage(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => {
          const own = card.myResponse.status === 'OWN_PHOTO'
          const line = statusLine(card)
          const uploader = card.photo.uploader
          return (
            <li key={card.photo.id} className="w-full shrink-0 snap-center px-px">
              <div
                className={`flex items-center gap-3 rounded-[18px] border bg-surface p-2.5 ${
                  line.todo ? 'border-point' : 'border-line'
                }`}
              >
                <img src={card.photo.imageUrl} alt={`${uploader.nickname}님의 사진`} className="size-14 shrink-0 rounded-[12px] bg-bg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[14px]">
                    <Flower code={uploader.flowerCode} size={16} />
                    <b className="font-bold">{own ? '내가' : uploader.nickname}</b>
                    {own ? ' 올렸어요' : ' 님이 올렸어요'}
                  </p>
                  <p className={`mt-0.5 truncate text-[12px] ${line.todo ? 'font-semibold text-point' : 'text-sub'}`}>
                    {[timeAgo(card.firstEntry?.confirmedAt), line.text].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* 친구 사진은 그 사진부터 덧붙이기 화면을 연다. 내 사진은 덧붙일 수 없어 버튼이 없다 */}
                {!own && (
                  <button
                    type="button"
                    aria-label={`${uploader.nickname}님 사진 보러 가기`}
                    onClick={() => navigate(paths.roomCirculation(roomId, card.photo.id))}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface active:opacity-80"
                  >
                    <ArrowIcon />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* 여러 장이면 점으로 몇 번째인지 보여주고, 눌러서도 넘길 수 있다 */}
      {cards.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label="사진 넘기기">
          {cards.map((card, i) => (
            <button
              key={card.photo.id}
              type="button"
              role="tab"
              aria-selected={page === i}
              aria-label={`${i + 1}번째 사진`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${page === i ? 'w-4 bg-ink' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default RecentPhotosCarousel
