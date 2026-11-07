import type { CSSProperties } from 'react'
import { templateArt } from './templateArt'

export type ScrollTemplateId = 'minimal' | 'gyeongju' | 'andong' | 'daegu' | 'pohang' | 'yeongcheon' | 'hwajeon'
export type RoomPlan = 'FREE' | 'LITE' | 'PRO'

export const SCROLL_TEMPLATES = [
  { id: 'minimal', name: '기본 미니멀', plan: 'FREE', background: '#eee8dd', accent: '#302b26', photo: '#efe9df', description: '사진과 이야기에 집중하는 기본 두루마리', art: templateArt('minimal') },
  { id: 'gyeongju', name: '경주', plan: 'LITE', background: '#f3ebdd', accent: '#925e3c', photo: '#e7dac2', description: '기와 지붕과 첨성대, 노을빛 종이 두루마리', art: templateArt('gyeongju') },
  { id: 'andong', name: '안동', plan: 'LITE', background: '#f1efdf', accent: '#7fa9aa', photo: '#e2decb', description: '하회마을 물돌이와 초가', art: templateArt('andong') },
  { id: 'daegu', name: '대구', plan: 'LITE', background: '#f8eeeb', accent: '#cb5261', photo: '#efd9d5', description: '사과와 팔공산 능선', art: templateArt('daegu') },
  { id: 'pohang', name: '포항', plan: 'LITE', background: '#fff3e9', accent: '#599ec0', photo: '#f5e0d0', description: '영일만 해돋이와 파도', art: templateArt('pohang') },
  { id: 'yeongcheon', name: '영천', plan: 'LITE', background: '#eeeaf6', accent: '#8e5cac', photo: '#ded8ec', description: '보현산 별과 포도', art: templateArt('yeongcheon') },
  { id: 'hwajeon', name: '화전놀이', plan: 'PRO', background: '#fbf0f3', accent: '#cc527f', photo: '#f3d5df', description: '꽃잎을 담은 특별 두루마리', art: templateArt('hwajeon') },
] as const satisfies readonly { id: ScrollTemplateId; name: string; plan: RoomPlan; background: string; accent: string; photo: string; description: string; art: string }[]

export function getTemplate(id: string | null | undefined) {
  return SCROLL_TEMPLATES.find((template) => template.id === id) ?? SCROLL_TEMPLATES[0]
}

export function canUseTemplate(id: ScrollTemplateId, plan: RoomPlan = 'FREE') {
  return ['FREE', 'LITE', 'PRO'].indexOf(plan) >= ['FREE', 'LITE', 'PRO'].indexOf(getTemplate(id).plan)
}

export function readTemplate(roomId: string): ScrollTemplateId {
  try { return getTemplate(localStorage.getItem(`duruduru:template:v1:${roomId}`)).id } catch { return 'minimal' }
}

export function saveTemplate(roomId: string, template: ScrollTemplateId) {
  try { localStorage.setItem(`duruduru:template:v1:${roomId}`, template) } catch { /* 현재 화면 선택은 유지한다. */ }
}
export function templateStyle(id: ScrollTemplateId): CSSProperties {
  const template = getTemplate(id)
  return { '--scroll-bg': template.background, '--scroll-accent': template.accent, '--scroll-photo': template.photo } as CSSProperties
}
