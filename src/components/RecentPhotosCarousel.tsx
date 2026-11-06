import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getCirculation } from '../api/memories'
import type { CirculationCard } from '../api/types'
import { getSeenStories, saveSeenStories } from '../lib/seenStories'
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
const ACTIVITY_SHOW_MS = 5000

function RecentPhotosCarousel({
  roomId,
  token,
  version,
  myMemberId,
}: {
  roomId: string
  token: string
  version: unknown
  myMemberId: string
}) {
  const navigate = useNavigate()
  const [cards, setCards] = useState<CirculationCard[]>([])
  const [page, setPage] = useState(0)
  const trackRef = useRef<HTMLUListElement>(null)
  // 사진마다 마지막으로 본 이야기 수. 처음 들어온 방이면 지금 수를 기준으로 삼아 배지를 띄우지 않는다
  const [seen, setSeen] = useState<Record<string, number> | null>(() => getSeenStories(roomId))
  // 화면을 보는 동안 새로 붙은 이야기 한 줄 안내 ("방금 민지님이 서연님 사진에 덧붙였어요")
  const [activity, setActivity] = useState<string | null>(null)
  const knownEntries = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!activity) return
    const timer = window.setTimeout(() => setActivity(null), ACTIVITY_SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [activity])

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

        // 처음 불러올 때는 지금 있는 이야기를 다 본 것으로 기억해 둔다
        setSeen((prev) => {
          if (prev) return prev
          const base = Object.fromEntries(sorted.map((c) => [c.photo.id, c.otherEntries.length]))
          saveSeenStories(roomId, base)
          return base
        })

        // 화면을 보는 동안 친구가 새로 덧붙였으면 한 줄로 알린다 (내가 쓴 건 빼고)
        const fresh = sorted.flatMap((c) =>
          c.otherEntries
            .filter((e) => knownEntries.current && !knownEntries.current.has(e.id) && e.member.id !== myMemberId)
            .map((e) => ({ entry: e, card: c })),
        )
        knownEntries.current = new Set(sorted.flatMap((c) => c.otherEntries.map((e) => e.id)))
        const latest = fresh.sort((a, b) => b.entry.confirmedAt.localeCompare(a.entry.confirmedAt))[0]
        if (latest) {
          const owner = latest.card.photo.uploader
          const whose = owner.id === myMemberId ? '내' : `${owner.nickname}님`
          setActivity(`방금 ${latest.entry.member.nickname}님이 ${whose} 사진에 이야기를 붙였어요`)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [roomId, token, version, myMemberId])

  if (cards.length === 0) return null

  // 본 것으로 표시: 그 사진의 이야기 수를 지금 수로 맞춘다
  const markSeen = (card: CirculationCard) => {
    const next = { ...(seen ?? {}), [card.photo.id]: card.otherEntries.length }
    setSeen(next)
    saveSeenStories(roomId, next)
  }
  const newCount = (card: CirculationCard) =>
    seen ? Math.max(0, card.otherEntries.length - (seen[card.photo.id] ?? 0)) : 0
  const totalNew = cards.reduce((sum, c) => sum + newCount(c), 0)

  const goTo = (index: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="mt-3" aria-label="친구들이 올린 사진">
      {/* 새 이야기가 붙은 순간 잠깐 보여주는 한 줄, 그 외에는 새 이야기 총 개수 */}
      {(activity || totalNew > 0) && (
        <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-point" role="status" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-point opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-point" />
          </span>
          {activity ?? `새 이야기 ${totalNew}개가 붙었어요`}
        </p>
      )}
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
          const fresh = newCount(card)
          return (
            <li key={card.photo.id} className="w-full shrink-0 snap-center px-px">
              <div
                // 내 사진은 보러 갈 곳이 없어서, 카드를 누르면 새 이야기를 본 것으로 표시한다
                onClick={own && fresh > 0 ? () => markSeen(card) : undefined}
                className={`flex items-center gap-3 rounded-[18px] border bg-surface p-2.5 ${
                  line.todo || fresh > 0 ? 'border-point' : 'border-line'
                }`}
              >
                <span className="relative shrink-0">
                  <img
                    src={card.photo.imageUrl}
                    alt=""
                    // 사진을 못 불러오면 깨진 아이콘 대신 빈 칸으로 둔다
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                    className="size-14 rounded-[12px] bg-[#efe9df] object-cover"
                  />
                  {fresh > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-point px-1.5 text-[10px] font-bold text-surface ring-2 ring-surface">
                      N{fresh > 1 ? ` ${fresh}` : ''}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[14px]">
                    <Flower code={uploader.flowerCode} size={16} />
                    <b className="font-bold">{own ? '내가' : uploader.nickname}</b>
                    {own ? ' 올렸어요' : ' 님이 올렸어요'}
                  </p>
                  <p className={`mt-0.5 truncate text-[12px] ${line.todo || fresh > 0 ? 'font-semibold text-point' : 'text-sub'}`}>
                    {fresh > 0
                      ? `새 이야기 ${fresh}개 · ${line.text}`
                      : [timeAgo(card.firstEntry?.confirmedAt), line.text].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* 친구 사진은 그 사진부터 덧붙이기 화면을 연다. 내 사진은 덧붙일 수 없어 버튼이 없다 */}
                {/* 내 사진도 덧붙일 수 있어서 모든 사진에 보러 가기 버튼을 둔다 */}
                {(

                  <button
                    type="button"
                    aria-label={own ? '내 사진 보러 가기' : `${uploader.nickname}님 사진 보러 가기`}
                    onClick={() => {
                      markSeen(card)
                      navigate(paths.roomCirculation(roomId, card.photo.id))
                    }}
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

      {/* 여러 장이면 점으로 몇 번째인지 보여주고, 눌러서도 넘길 수 있다.
          마우스로는 옆으로 밀 수 없어서, 마우스를 쓰는 PC에서는 양옆에 이전·다음 버튼도 보여준다 */}
      {cards.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="이전 사진"
            disabled={page === 0}
            onClick={() => goTo(page - 1)}
            className="hidden size-7 items-center justify-center rounded-full border border-line bg-surface text-sub disabled:opacity-30 [@media(hover:hover)]:flex"
          >
            <span className="rotate-180">
              <ArrowIcon />
            </span>
          </button>
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="사진 넘기기">
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
          <button
            type="button"
            aria-label="다음 사진"
            disabled={page === cards.length - 1}
            onClick={() => goTo(page + 1)}
            className="hidden size-7 items-center justify-center rounded-full border border-line bg-surface text-sub disabled:opacity-30 [@media(hover:hover)]:flex"
          >
            <ArrowIcon />
          </button>
        </div>
      )}
    </section>
  )
}

export default RecentPhotosCarousel
