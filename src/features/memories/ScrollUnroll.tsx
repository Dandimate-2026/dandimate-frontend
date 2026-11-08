import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'

const OPEN_AFTER = 90 // 이만큼 끌어내리면 놓았을 때 끝까지 펼친다
const UNTIE_MS = 550 // 끈이 풀리는 시간

type Phase = 'tied' | 'untying' | 'closed' | 'dragging' | 'opening' | 'done'

/**
 * 두루마리를 사용자가 직접 펼친다.
 * 끈을 한 번 누르면 끈이 풀리고, 이어서 두루마리가 저절로 아래로 펼쳐진다.
 * 두루마리를 열 때마다(템플릿을 바꿨을 때도) 끈이 묶인 채로 시작한다.
 */
export default function ScrollUnroll({ showRod }: { showRod: boolean }) {
  // 위쪽 봉의 실제 위치·폭을 재서 아래 봉을 똑같이 맞춘다
  const [rod, setRod] = useState<{ top: number; left: number; width: number } | null>(null)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<Phase>(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'tied')
  const startY = useRef(0)
  const done = phase === 'done'

  useLayoutEffect(() => {
    if (done) return
    // 이전 화면에서 내려와 있던 스크롤이 남으면, 펼치기 전 화면을 잠그면서 위쪽(그림·봉·제목)으로 못 올라간다.
    // 끈이 묶인 채로 시작할 때는 맨 위로 올린 뒤 봉 위치를 잰다
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    const previousAnchor = html.style.overflowAnchor
    html.style.overflow = 'hidden'
    html.style.overflowAnchor = 'none'
    const measure = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      const top = document.querySelector('.scroll-live > .scroll-rod')?.getBoundingClientRect()
      if (top) setRod({ top: top.bottom, left: top.left, width: top.width })
    }
    measure()
    // 브라우저의 스크롤 복원과 이미지 레이아웃이 끝난 뒤에도 봉 위치를 맞춘다.
    const frame = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    const hero = document.querySelector('.scroll-live > .scroll-template-hero')
    if (hero) observer.observe(hero)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      html.style.overflow = previousOverflow
      html.style.overflowAnchor = previousAnchor
    }
  }, [done])

  if (phase === 'done') return null
  const start = rod?.top ?? 124

  const untie = () => {
    setPhase('untying')
    window.setTimeout(open, UNTIE_MS)
  }
  function open() {
    setPhase('opening')
    setOffset(window.innerHeight)
    window.setTimeout(() => setPhase('done'), 1700)
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase === 'tied') { untie(); return }
    if (phase !== 'closed') return
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    setPhase('dragging')
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (phase === 'dragging') setOffset(Math.max(0, e.clientY - startY.current))
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'dragging') return
    const moved = e.clientY - startY.current
    if (moved < 8) open()
    else if (moved > OPEN_AFTER) open()
    else { setOffset(0); setPhase('closed') }
  }

  // 덮개는 가운데 정렬(최대 430px)이라, 위쪽 봉의 화면 위치를 덮개 기준으로 바꿔 똑같은 자리·폭에 그린다
  const coverLeft = (window.innerWidth - Math.min(window.innerWidth, 430)) / 2
  const rodStyle: CSSProperties | undefined = rod ? { position: 'absolute', top: 0, left: rod.left - coverLeft, width: rod.width, margin: 0 } : undefined
  const tied = phase === 'tied' || phase === 'untying'

  return (
    <div
      className={`scroll-unroll-cover is-${phase}`}
      style={{ top: start + offset }}
      role="button"
      tabIndex={0}
      aria-label={tied ? '두루마리 끈 풀기' : '두루마리 펼치기'}
      onKeyDown={(e) => { if (e.key !== 'Enter' && e.key !== ' ') return; if (phase === 'tied') untie(); else if (phase === 'closed') open() }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {showRod && (
        <div className="scroll-rod" style={rodStyle}>
          {tied && (
            <span className="scroll-unroll-tie" aria-hidden="true">
              <span className="scroll-unroll-bow"><span /><i /><i /></span>
            </span>
          )}
        </div>
      )}
      {phase === 'tied' && (
        <p className="scroll-unroll-hint" style={{ marginTop: showRod ? 48 : 26 }}>눌러서 끈을 풀어 주세요</p>
      )}
      {phase === 'closed' && (
        <p className="scroll-unroll-hint" style={{ marginTop: showRod ? 48 : 26 }}>
          <span aria-hidden="true">↓</span>
          아래로 당기거나 눌러서 펼쳐 보세요
        </p>
      )}
    </div>
  )
}
