import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

/** 손잡이를 이만큼 아래로 끌면 시트를 내린다 */
const CLOSE_DRAG_PX = 90

/**
 * 바텀시트 위쪽 손잡이(—)를 아래로 끌어 내리면 닫는다. 모든 바텀시트가 같은 방식으로 동작하게 한다.
 * - handleProps: 손잡이 영역에 붙인다
 * - sheetStyle: 시트 본체에 붙인다 (끄는 만큼 따라 내려간다)
 */
export function useSheetDrag(onClose: () => void) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<number | null>(null)
  const latest = useRef(0)

  const end = () => {
    if (start.current === null) return
    start.current = null
    setDragging(false)
    if (latest.current > CLOSE_DRAG_PX) onClose()
    latest.current = 0
    setDragY(0)
  }

  const handleProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      start.current = e.clientY
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (start.current === null) return
      latest.current = Math.max(0, e.clientY - start.current)
      setDragY(latest.current)
    },
    onPointerUp: end,
    onPointerCancel: end,
    style: { touchAction: 'none', cursor: 'grab' } as CSSProperties,
  }

  const sheetStyle: CSSProperties = {
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.2s',
  }

  return { handleProps, sheetStyle }
}
