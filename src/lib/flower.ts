import type { FlowerCode } from '../api/types'

// 꽃 색 8가지 (앱 전체 통일). 서버는 방에 들어온 순서대로 아래 순서의 꽃 코드를 준다
// 1 AZALEA · 2 FORSYTHIA · 3 ROYAL_AZALEA · 4 CANOLA · 5 LILAC · 6 FORGET_ME_NOT · 7 TEAL · 8 PURPLE
// 그래서 들어온 순서대로 분홍 · 주황 · 파랑 · 청록 · 보라 · 황토 · 자주 · 올리브가 된다
export const FLOWER_COLOR: Record<FlowerCode, string> = {
  AZALEA: '#E0568F',
  FORSYTHIA: '#E08A12',
  ROYAL_AZALEA: '#3D7BD6',
  CANOLA: '#428E80',
  LILAC: '#946DC4',
  FORGET_ME_NOT: '#B59633',
  TEAL: '#8E2A6B',
  PURPLE: '#728C0E',
}

/** 기억(돌려보기·두루마리) 화면도 같은 8가지 색 꽃을 쓴다 (예전 3색 그림 대신 꽃 코드 그대로) */
export function memoryFlowerColor(code: FlowerCode): FlowerCode {
  return code
}
