import type { CSSProperties } from 'react'
import { templateArt } from './templateArt'
// 지역·특별 템플릿 그림 (디자인 시안 그림)
import gyeongjuArt from '../../assets/templates/gyeongju.webp'
import andongArt from '../../assets/templates/andong.webp'
import daeguArt from '../../assets/templates/daegu.webp'
import pohangArt from '../../assets/templates/pohang.webp'
import yeongcheonArt from '../../assets/templates/yeongcheon.webp'
import christmasArt from '../../assets/templates/christmas.webp'

export type ScrollTemplateId = 'minimal' | 'gyeongju' | 'andong' | 'daegu' | 'pohang' | 'yeongcheon' | 'christmas'
export type RoomPlan = 'FREE' | 'LITE' | 'PRO'

export const SCROLL_TEMPLATES = [
  { id: 'minimal', name: '기본 미니멀', plan: 'FREE', background: '#eee8dd', accent: '#302b26', photo: '#efe9df', ribbon: '#c85570', description: '사진과 이야기에 집중하는 기본 두루마리', art: templateArt('minimal') },
  { id: 'gyeongju', name: '경주', plan: 'LITE', background: '#f3ebdd', accent: '#925e3c', photo: '#e7dac2', ribbon: '#8f5634', description: '기와 지붕과 첨성대, 노을빛 종이 두루마리', art: gyeongjuArt },
  { id: 'andong', name: '안동', plan: 'LITE', background: '#f1efdf', accent: '#7fa9aa', photo: '#e2decb', ribbon: '#4f8388', description: '하회마을 물돌이와 초가', art: andongArt },
  { id: 'daegu', name: '대구', plan: 'LITE', background: '#f8eeeb', accent: '#cb5261', photo: '#efd9d5', ribbon: '#b53f36', description: '사과와 팔공산 능선', art: daeguArt },
  { id: 'pohang', name: '포항', plan: 'LITE', background: '#fff3e9', accent: '#599ec0', photo: '#f5e0d0', ribbon: '#336f9e', description: '영일만 해돋이와 파도', art: pohangArt },
  { id: 'yeongcheon', name: '영천', plan: 'LITE', background: '#eeeaf6', accent: '#8e5cac', photo: '#ded8ec', ribbon: '#6352a4', description: '보현산 별과 포도', art: yeongcheonArt },
  // Pro 특별 꾸미기: 시즌 한정 템플릿 (지금은 크리스마스)
  { id: 'christmas', name: '크리스마스', plan: 'PRO', background: '#f7eeea', accent: '#C9372F', photo: '#f0e1db', ribbon: '#C9372F', description: '겨울 시즌 한정 특별 두루마리', art: christmasArt },
] as const satisfies readonly { id: ScrollTemplateId; name: string; plan: RoomPlan; background: string; accent: string; photo: string; ribbon: string; description: string; art: string }[]

export function getTemplate(id: string | null | undefined) {
  return SCROLL_TEMPLATES.find((template) => template.id === id) ?? SCROLL_TEMPLATES[0]
}

export function canUseTemplate(id: ScrollTemplateId, plan: RoomPlan = 'FREE') {
  return ['FREE', 'LITE', 'PRO'].indexOf(plan) >= ['FREE', 'LITE', 'PRO'].indexOf(getTemplate(id).plan)
}

/** 서버가 CLASSIC으로 저장하는 기본 템플릿을 화면의 minimal과 맞춘다. */
export function fromServerTemplate(id: string | null | undefined): ScrollTemplateId {
  return getTemplate(id === 'CLASSIC' ? 'minimal' : id?.toLowerCase()).id
}

export function templateStyle(id: ScrollTemplateId): CSSProperties {
  const template = getTemplate(id)
  // 끈(리본) 색: 템플릿마다 시안 색 (ribbon)
  return { '--scroll-bg': template.background, '--scroll-accent': template.accent, '--scroll-photo': template.photo, '--scroll-ribbon': template.ribbon } as CSSProperties
}
