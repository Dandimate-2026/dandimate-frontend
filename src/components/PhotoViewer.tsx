import { useEffect, useState, type ImgHTMLAttributes, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

/** 사진 전체 화면 보기. 검은 배경에 사진을 꽉 맞춰 보여주고, X·바깥·Esc로 닫는다 */
export function PhotoViewer({ src, alt = '', onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    document.addEventListener('keydown', onKeyDown)
    // 보는 동안 뒤 화면이 스크롤되지 않게 막는다
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = old
    }
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
    >
      <img src={src} alt={alt} draggable={false} onContextMenu={event => event.preventDefault()} onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] max-w-full object-contain select-none [-webkit-touch-callout:none]" />
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>,
    document.body,
  )
}

/** 누르면 전체 화면으로 커지는 사진. 사진 주소가 없으면 그냥 아무것도 안 한다 */
export function ViewablePhoto({ src, alt = '', className, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src?: string }) {
  const [open, setOpen] = useState(false)
  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    // 카드·링크 안에 있어도 사진을 누르면 크게 보기만 한다
    e.preventDefault()
    e.stopPropagation()
    if (src) setOpen(true)
  }
  return (
    <>
      <img src={src} alt={alt} draggable={false} onContextMenu={event => event.preventDefault()} className={`${className ?? ''} cursor-zoom-in select-none [-webkit-touch-callout:none]`} onClick={handleClick} {...rest} />
      {open && src && <PhotoViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}
