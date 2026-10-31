import type { FlowerCode } from '../api/types'

// 백엔드 FlowerCode → 꽃 색상
// TODO: 시안에 있는 3색(진달래·물망초·개나리) 외 나머지는 디자이너 확인 필요
export const FLOWER_COLOR: Record<FlowerCode, string> = {
  AZALEA: '#E0568F',
  FORGET_ME_NOT: '#3D7BD6',
  FORSYTHIA: '#E08A12',
  ROYAL_AZALEA: '#C2407A',
  CANOLA: '#E8C21A',
  LILAC: '#A77BD6',
  TEAL: '#2A9D8F',
  PURPLE: '#7A4FC2',
}
