import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../routes/paths'
import type { CirculationCard, FlowerCode, RoomStatus } from '../api/types'
import { FLOWER_COLOR } from '../lib/flower'
import Flower from './Flower'
import { canEditRoomRecords } from '../lib/roomState'

const W = 340 // 가지 그림 가로 (viewBox)
const H = 84 // 가지 영역 높이(px)
const SLOTS = 8 // 방 최대 인원. 꽃 자리는 인원과 상관없이 8칸에 고정한다

/** 가지가 지나가는 높이: 왼쪽에서 오른쪽으로 살짝 올라가는 완만한 물결 */
const branchY = (t: number) => H / 2 + 4 - t * 6 + 5 * Math.sin(t * Math.PI * 1.6)
/** i번째 꽃의 고정 자리 (0~1) */
const slotT = (i: number) => (i + 0.5) / SLOTS

/** 활동 수에 따른 꽃 크기: 많을수록 조금씩 크게 */
const sizeFor = (count: number) => (count >= 8 ? 30 : count >= 5 ? 28 : count >= 3 ? 25 : 22)

type Person = { id: string | number; nickname: string; flowerCode: FlowerCode; photoCount?: number; storyCount?: number }

/**
 * 핀 꽃: 한 줄짜리 가지에 사진이나 이야기를 남긴 사람마다 꽃 한 송이.
 * 자리는 들어온 순서대로 고정(1번째는 맨 왼쪽 칸…)이고, 아직 아무것도 남기지 않은 사람 자리는 비워 둔다.
 * 꽃의 숫자는 그 사람이 한 모든 활동(사진 + 이야기). 꽃을 누르면 참여한 사진별로 그 활동을 모아 넘겨 본다.
 */
export default function BranchFlowers({ roomId, status, members, cards }: { roomId: string; status: RoomStatus; members: Person[]; cards: CirculationCard[] | null }) {
  const [open, setOpen] = useState<Person | null>(null)

  // 꽃의 숫자 = 그 사람이 한 모든 활동(올린 사진 + 남긴 이야기). 꽃을 누르면 그 활동들을 사진별로 모아 넘겨 본다
  const people = members.slice(0, SLOTS).map((m) => ({ ...m, count: (m.photoCount ?? 0) + (m.storyCount ?? 0) }))
  const pts = Array.from({ length: 41 }, (_, k) => `${((k / 40) * W).toFixed(1)},${branchY(k / 40).toFixed(1)}`).join(' ')

  return (
    <>
      <div className="relative mt-1 w-full" style={{ height: H }} aria-label={`핀 꽃 ${people.filter((p) => p.count > 0).length}송이`}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts} fill="none" stroke="#7a553f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts} fill="none" stroke="#b08a6c" strokeWidth="1" strokeLinecap="round" opacity=".45" transform="translate(0 -1)" />
          <path d={`M10 ${branchY(10 / W)} q 6 -13 18 -12 q -5 10 -18 12`} fill="#93ad6c" />
          <path d={`M18 ${branchY(18 / W)} q 8 10 18 8 q -6 -9 -18 -8`} fill="#a9c083" />
          <path d={`M${W - 14} ${branchY(1 - 14 / W)} q -6 -13 -18 -12 q 5 10 18 12`} fill="#93ad6c" />
          {people.map((p, i) => {
            if (p.count === 0) return null
            const x = slotT(i) * W
            const by = branchY(slotT(i))
            const up = i % 2 === 0
            const tip = up ? by - 12 : by + 12
            return <path key={p.id} d={`M${x} ${by} Q ${x + (up ? 3 : -3)} ${(by + tip) / 2} ${x} ${tip}`} stroke="#6f8a52" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          })}
        </svg>

        {people.map((p, i) => {
          if (p.count === 0) return null
          const t = slotT(i)
          const by = branchY(t)
          const up = i % 2 === 0
          const size = sizeFor(p.count)
          const cy = up ? by - 12 - size / 2 + 3 : by + 12 + size / 2 - 3
          const style = { left: `${t * 100}%`, top: cy, animationDelay: `${i * 120}ms` } as CSSProperties
          return (
            <button
              key={p.id}
              type="button"
              className="branch-flower absolute"
              style={style}
              onClick={() => setOpen(p)}
              aria-label={`${p.nickname} · 사진과 이야기 ${p.count}개`}
            >
              <Flower code={p.flowerCode} size={size} />
              <span className="branch-count" style={{ background: FLOWER_COLOR[p.flowerCode] }}>{p.count}</span>
            </button>
          )
        })}
      </div>
      {open && <FlowerSheet editable={canEditRoomRecords(status)} person={open} roomId={roomId} slides={cards ? slidesFor(cards, open) : null} onClose={() => setOpen(null)} />}
    </>
  )
}

/** 그 사람이 올린 사진 한 장에 한 페이지: 사진과 그 사람의 첫 한마디(그리고 직접 덧붙인 말), 최근 것부터.
 * 다른 사람 사진에 남긴 이야기는 둘러보기에서 보도록 여기에 담지 않는다 (잠금 계산이 필요 없다) */
function slidesFor(cards: CirculationCard[], person: Person): Slide[] {
  const isMe = (m: { id: string; nickname: string }) => String(m.id) === String(person.id) || m.nickname === person.nickname
  return cards
    .filter((card) => isMe(card.photo.uploader))
    .map((card) => {
      const entries = [card.firstEntry, ...card.otherEntries].filter((e): e is NonNullable<typeof e> => Boolean(e) && isMe(e!.member))
      const at = entries.map((e) => e.confirmedAt).sort().pop() ?? card.firstEntry?.confirmedAt ?? ''
      return {
        photoId: card.photo.id,
        imageUrl: card.photo.imageUrl,
        at,
        entries: entries.map((e) => ({ id: e.id, first: e.kind === 'FIRST', text: e.transcript })),
      }
    })
    .sort((x, y) => y.at.localeCompare(x.at))
}

type Slide = { photoId: string; imageUrl: string; at: string; entries: { id: string; first: boolean; text: string }[] }

/** 꽃을 눌렀을 때: 그 사람이 올린 사진을 한 장씩 넘겨 본다. 장마다 덧붙이러 갈 수 있다 */
function FlowerSheet({ person, roomId, slides, onClose, editable }: { editable: boolean; person: Person; roomId: string; slides: Slide[] | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const goTo = (i: number) => trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: 'smooth' })
  const go = (photoId: string) => { onClose(); navigate(paths.roomCirculation(roomId, photoId)) }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="flower-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full max-w-[390px] flex-col rounded-[24px] bg-bg pb-4 text-ink shadow-xl"
      >
        <header className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <Flower code={person.flowerCode} size={28} />
          <div className="min-w-0 flex-1">
            <h2 id="flower-sheet-title" className="truncate text-[17px] font-bold">{person.nickname}님이 올린 사진</h2>
            {/* 꽃 숫자(사진 + 이야기)를 풀어서 보여 준다 */}
            <p className="text-[12px] text-sub">사진 {person.photoCount ?? 0}장 · 이야기 {person.storyCount ?? 0}개</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex size-9 items-center justify-center rounded-full text-[22px] text-sub active:opacity-70">×</button>
        </header>

        {slides === null && <p className="py-10 text-center text-[13px] text-sub">불러오는 중…</p>}
        {slides?.length === 0 && (
          <p className="px-5 py-10 text-center text-[13px] leading-5 text-sub">
            {(person.photoCount ?? 0) > 0 ? <>{person.nickname}님이 올린 사진은 아직 첫 한마디 전이에요<br />다 남기면 여기에 올라와요</> : <>아직 {person.nickname}님이 올린 사진이 없어요</>}
            {(person.storyCount ?? 0) > 0 && <><br />다른 사진에 남긴 이야기는 돌려보기에서 볼 수 있어요</>}
          </p>
        )}
        {/* 홈 숫자는 올리기만 한 사진까지 세고, 여기는 첫 한마디까지 마쳐 공개된 사진만 보인다 */}
        {slides && slides.length > 0 && (person.photoCount ?? 0) > slides.length && (
          <p className="mx-5 mb-2 text-[11px] text-sub">
            {(person.photoCount ?? 0) - slides.length}장은 아직 첫 한마디 전이라 다 남기면 여기에 올라와요
          </p>
        )}
        {slides && slides.length > 0 && (
          <>
            <div
              ref={trackRef}
              onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              className="flex min-h-0 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {slides.map((sl) => (
                <article key={sl.photoId} className="flex w-full shrink-0 snap-center flex-col px-5">
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {sl.imageUrl
                      ? <img src={sl.imageUrl} alt="" className="aspect-[16/10] w-full rounded-[16px] bg-[#ece6dc] object-cover" />
                      : <span className="block aspect-[16/10] w-full rounded-[16px] bg-[#ece6dc]" aria-hidden="true" />}
                    <ul className="mt-2.5 flex flex-col gap-2">
                      {sl.entries.map((e) => (
                        <li key={e.id} className="rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
                          <span className="text-[11px] font-semibold text-point">{e.first ? '첫 한마디' : '덧붙이기'}</span>
                          <p className="mt-0.5 text-[14px] leading-[21px]">{e.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {editable && <button type="button" onClick={() => go(sl.photoId)} className="mt-3 h-11 w-full shrink-0 rounded-full bg-ink text-[14px] font-semibold text-surface active:opacity-80">
                    이 사진에 덧붙이러 가기
                  </button>}
                </article>
              ))}
            </div>
            {slides.length > 1 && <nav className="flex justify-center gap-1.5 px-5 pt-3" aria-label="넘기기">
              {slides.map((sl, i) => (
                <button
                  key={sl.photoId}
                  type="button"
                  aria-current={page === i}
                  onClick={() => goTo(i)}
                  className={`flex size-7 items-center justify-center rounded-full text-[13px] font-semibold ${page === i ? 'bg-ink text-surface' : 'border border-line bg-surface text-sub'}`}
                >
                  {i + 1}
                </button>
              ))}
            </nav>}
          </>
        )}
      </section>
    </div>
  )
}
