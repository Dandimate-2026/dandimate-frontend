import { useEffect, useRef, useState } from 'react'

export interface MoreMenuItem {
  label: string
  onSelect: () => void
  /** 지우기처럼 되돌리기 어려운 동작은 분홍 글씨 */
  danger?: boolean
}

/** 세로 점 세 개(⋮) 버튼. 누르면 작은 메뉴가 펼쳐진다. 바깥을 누르거나 Esc로 닫힌다 */
function MoreMenu({ items, label = '더 보기' }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-full text-sub active:bg-black/5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[120px] overflow-hidden rounded-[14px] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(42,38,35,0.14)]"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={`w-full px-4 py-2.5 text-left text-[14px] active:bg-bg ${item.danger ? 'text-point' : 'text-ink'}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MoreMenu
