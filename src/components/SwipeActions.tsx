import { useRef, useState, type ReactNode } from 'react'

type Action = { label: string; onClick: () => void; danger?: boolean }

/** Horizontal gestures reveal an action; they never execute it. Vertical scrolling stays native. */
export default function SwipeActions({ children, share, remove }: { children: ReactNode; share?: Action; remove?: Action }) {
  const [side, setSide] = useState<'share' | 'remove' | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const action = side === 'share' ? share : side === 'remove' ? remove : undefined
  const shift = action ? (side === 'share' ? -88 : 88) : 0
  return <div className={`relative isolate overflow-hidden rounded-2xl ${action ? 'z-30' : ''}`} style={{ touchAction: 'pan-y' }} onDragStart={event => event.preventDefault()}
    onKeyDown={event => { if (event.key === 'Escape') setSide(null); else if (event.key === 'ArrowLeft' && share) { event.preventDefault(); setSide('share') } else if (event.key === 'ArrowRight' && remove) { event.preventDefault(); setSide('remove') } }}
    onPointerDown={event => { if (event.pointerType === 'mouse' && event.button !== 0) return; start.current = { x: event.clientX, y: event.clientY }; moved.current = false }}
    onPointerMove={event => {
      if (!start.current) return
      const dx = event.clientX - start.current.x, dy = event.clientY - start.current.y
      if (Math.abs(dx) < 32 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      moved.current = true
      setSide(dx < 0 ? (share ? 'share' : null) : (remove ? 'remove' : null))
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerUp={() => { start.current = null }} onPointerCancel={() => { start.current = null }}
    onClickCapture={event => { if (moved.current) { event.preventDefault(); event.stopPropagation(); moved.current = false } }}>
    {action && <button type="button" className={`absolute inset-y-0 flex w-[88px] items-center justify-center px-2 text-[13px] font-semibold ${side === 'share' ? 'right-0 bg-ink text-surface' : 'left-0 bg-red-50 text-red-700'}`} onClick={() => { setSide(null); action.onClick() }}>{action.label}</button>}
    <div className="relative transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `translateX(${shift}px)` }} inert={Boolean(action)}>{children}</div>
    {action && <button type="button" className={`absolute inset-y-0 ${side === 'share' ? 'right-[88px] left-0' : 'right-0 left-[88px]'}`} aria-label="밀기 메뉴 닫기" onClick={() => setSide(null)} />}
  </div>
}
