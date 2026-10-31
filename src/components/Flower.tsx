import type { FlowerCode } from '../api/types'
import { FLOWER_COLOR } from '../lib/flower'

// 꽃잎 5장의 중심 좌표 (30x30 기준)
const PETALS = [
  [15, 7.5],
  [22.2, 12.75],
  [19.5, 21.3],
  [10.5, 21.3],
  [7.8, 12.75],
]

/** 방에 들어온 친구를 나타내는 꽃 아이콘 */
function Flower({ code, size = 30 }: { code: FlowerCode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      {PETALS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5.4" fill={FLOWER_COLOR[code]} />
      ))}
      <circle cx="15" cy="15" r="3.15" fill="white" />
    </svg>
  )
}

/** 아직 비어 있는 자리 */
export function EmptySlot() {
  return <span className="block size-[30px] rounded-full border border-dashed border-sub" aria-hidden="true" />
}

export default Flower
