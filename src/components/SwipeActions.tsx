import { useEffect, useRef, useState, type ReactNode } from 'react'

type Action = { label: string; onClick: () => void; danger?: boolean; iconOnly?: boolean }
const WIDTH = 88

/** Follow the finger, then settle on a button. A swipe never executes an action. */
export default function SwipeActions({ children, share, remove, disabled = false }: { children: ReactNode; share?: Action; remove?: Action; disabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const position = useRef(0)
  const gesture = useRef<{ x: number; y: number; base: number; lastX: number; at: number; velocity: number; axis: 'x' | 'y' | null } | null>(null)
  const suppressClick = useRef(false)
  const move = (value: number) => { position.current = value; setOffset(value) }
  useEffect(() => {
    if (!offset || dragging) return
    const outside = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) { position.current = 0; setOffset(0) } }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [offset, dragging])
  const finish = (cancelled: boolean, releasedAt: number) => {
    const current = gesture.current
    gesture.current = null; setDragging(false)
    if (current?.axis !== 'x') return
    const velocity = releasedAt - current.at < 100 ? current.velocity : 0
    const projected = cancelled ? 0 : position.current + velocity * 100
    move(position.current > 0 && projected > WIDTH / 2 && share ? WIDTH : position.current < 0 && projected < -WIDTH / 2 && remove ? -WIDTH : 0)
  }
  return <div ref={root} className="relative isolate overflow-hidden rounded-[20px]" style={{ touchAction: 'pan-y' }} onDragStart={event => event.preventDefault()}
    onKeyDown={event => {
      if (disabled) return
      if (event.key === 'Escape') move(0)
      else if (event.key === 'ArrowLeft' && remove) { event.preventDefault(); move(-WIDTH) }
      else if (event.key === 'ArrowRight' && share) { event.preventDefault(); move(WIDTH) }
    }}
    onPointerDown={event => {
      if (disabled || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || (event.target as Element).closest('[data-swipe-action]')) return
      suppressClick.current = false
      gesture.current = { x: event.clientX, y: event.clientY, base: position.current, lastX: event.clientX, at: event.timeStamp, velocity: 0, axis: null }
    }}
    onPointerMove={event => {
      const current = gesture.current
      if (!current) return
      const dx = event.clientX - current.x, dy = event.clientY - current.y
      if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) current.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y'
      if (current.axis !== 'x') return
      if (!dragging) { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId) }
      suppressClick.current = true
      current.velocity = (event.clientX - current.lastX) / Math.max(1, event.timeStamp - current.at)
      current.lastX = event.clientX; current.at = event.timeStamp
      const raw = current.base + dx
      const limited = raw > 0 ? (share ? Math.min(raw, WIDTH) : 0) : (remove ? Math.max(raw, -WIDTH) : 0)
      move(limited + (raw - limited) * .12)
    }}
    onPointerUp={event => finish(false, event.timeStamp)} onPointerCancel={event => finish(true, event.timeStamp)}
    onClickCapture={event => { if (suppressClick.current && !(event.target as Element).closest('[data-swipe-action]')) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false } }}>
    {share && <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: Math.max(0, offset), transition: dragging ? 'none' : 'width 240ms cubic-bezier(.22,.8,.3,1)' }}>
      <button data-swipe-action type="button" disabled={disabled} tabIndex={offset > 0 ? 0 : -1} aria-hidden={offset <= 0} className="absolute inset-y-0 left-0 flex w-[88px] flex-col items-center justify-center gap-2 bg-ink text-[12px] font-semibold text-surface" onClick={() => { move(0); share.onClick() }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V2m-4 4 4-4 4 4M7 9H4v12h16V9h-3" /></svg>{share.label}</button>
    </div>}
    {remove && <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ width: Math.max(0, -offset), transition: dragging ? 'none' : 'width 240ms cubic-bezier(.22,.8,.3,1)' }}>
      <button data-swipe-action type="button" disabled={disabled} tabIndex={offset < 0 ? 0 : -1} aria-hidden={offset >= 0} className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-2 bg-[#B9434B] text-[12px] font-semibold text-white" onClick={() => { move(0); remove.onClick() }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg><span className={remove.iconOnly ? 'sr-only' : undefined}>{remove.label}</span></button>
    </div>}
    <div className="relative bg-surface motion-reduce:!transition-none" style={{ transform: `translate3d(${offset}px,0,0)`, transition: dragging ? 'none' : 'transform 240ms cubic-bezier(.22,.8,.3,1)' }}>
      {children}
      {offset !== 0 && !dragging && <button type="button" className="absolute inset-0 rounded-[20px]" aria-label="밀기 메뉴 닫기" onClick={() => move(0)} />}
    </div>
  </div>
}
