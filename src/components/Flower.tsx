import type { FlowerCode } from '../api/types'

// 백엔드 FlowerCode → 꽃 색상
// TODO: 시안에 있는 3색(진달래·물망초·개나리) 외 나머지는 디자이너 확인 필요
const FLOWER_COLOR: Record<FlowerCode, string> = {
  AZALEA: '#E0568F',
  FORGET_ME_NOT: '#3D7BD6',
  FORSYTHIA: '#E08A12',
  ROYAL_AZALEA: '#C2407A',
  CANOLA: '#E8C21A',
  LILAC: '#A77BD6',
  TEAL: '#2A9D8F',
  PURPLE: '#7A4FC2',
}

// 꽃잎 5장의 중심 좌표 (30x30 기준)
const PETALS = [
  [15, 7.5],
  [22.2, 12.75],
  [19.5, 21.3],
  [10.5, 21.3],
  [7.8, 12.75],
]

/** 방에 들어온 친구를 나타내는 꽃 아이콘 */
function Flower({ code }: { code: FlowerCode }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
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
