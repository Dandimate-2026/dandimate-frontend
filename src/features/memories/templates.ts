import type { CSSProperties } from 'react'
import pinkFlowerSvg from '../../assets/memories/flower-pink.svg?raw'
import scrollFlowerSvg from '../../assets/memories/scroll-flower.svg?raw'

const pinkFlowerImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinkFlowerSvg)}`
const scrollFlowerImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scrollFlowerSvg)}`

export type ScrollTemplateId = 'minimal' | 'gyeongju' | 'andong' | 'daegu' | 'pohang' | 'yeongcheon' | 'hwajeon'
export type RoomPlan = 'FREE' | 'LITE' | 'PRO'

function illustration(shapes: string, background: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180" viewBox="0 0 360 180"><rect width="360" height="180" fill="${background}"/>${shapes}</svg>`)}`
}

export const SCROLL_TEMPLATES = [
  { id: 'minimal', name: '기본 미니멀', plan: 'FREE', background: '#f7f3ec', accent: '#b03a6a', photo: '#efe9df', description: '사진과 이야기에 집중하는 기본 두루마리', art: illustration(`<image href="${scrollFlowerImage}" x="131.5" y="32" width="97" height="116"/>`, '#f7f3ec') },
  { id: 'gyeongju', name: '경주', plan: 'LITE', background: '#f3ebdd', accent: '#c5a477', photo: '#e7dac2', description: '기와 지붕과 첨성대, 노을빛 종이 두루마리', art: illustration('<circle cx="262" cy="38" r="26" fill="#ebbb8e"/><path d="M0 100Q70 38 180 100T360 80V180H0" fill="#cbb695"/><path d="M137 165L153 67H200L216 165Z" fill="#89694a"/><rect x="168" y="110" width="17" height="22" fill="#eedfc5"/><path d="M142 65H209V73H142Z" fill="#705335"/><path d="M0 159Q180 118 360 162V180H0" fill="#6f5336"/>', '#eaddc6') },
  { id: 'andong', name: '안동', plan: 'LITE', background: '#f1efdf', accent: '#7fa9aa', photo: '#e2decb', description: '하회마을 물돌이와 초가', art: illustration('<path d="M-20 25C350-5 300 85 230 108S70 140 68 190" fill="none" stroke="#a1c5c6" stroke-width="44"/><path d="M207 94Q242 49 279 94Z" fill="#c5ad76"/><rect x="219" y="94" width="49" height="33" fill="#f7f2dd"/>', '#e7e3cf') },
  { id: 'daegu', name: '대구', plan: 'LITE', background: '#f8eeeb', accent: '#cb5261', photo: '#efd9d5', description: '사과와 팔공산 능선', art: illustration('<g fill="#d64350"><circle cx="130" cy="13" r="39"/><circle cx="169" cy="13" r="39"/></g><path d="M0 180L90 86L158 161L245 32L360 180" fill="#b7c7a3"/><path d="M25 180L90 139L160 180" fill="#8eaa7d"/>', '#f3e4e1') },
  { id: 'pohang', name: '포항', plan: 'LITE', background: '#fff3e9', accent: '#599ec0', photo: '#f5e0d0', description: '영일만 해돋이와 파도', art: illustration('<circle cx="180" cy="124" r="65" fill="#f4a565"/><path d="M0 124H360V180H0Z" fill="#7eb1cb"/><path d="M-20 164Q25 135 70 158T160 159T250 160T380 155" fill="none" stroke="#fffdf9" stroke-width="9"/>', '#fde7d5') },
  { id: 'yeongcheon', name: '영천', plan: 'LITE', background: '#eeeaf6', accent: '#8e5cac', photo: '#ded8ec', description: '보현산 별과 포도', art: illustration('<g fill="#fff3c4"><circle cx="65" cy="28" r="5"/><circle cx="280" cy="50" r="5"/><circle cx="25" cy="123" r="5"/></g><path d="M0 180Q70 133 156 180T360 138V180" fill="#454b6c"/><circle cx="249" cy="150" r="29" fill="#eae5f6"/><rect x="224" y="150" width="50" height="24" fill="#eae5f6"/>', '#30344f') },
  { id: 'hwajeon', name: '화전놀이', plan: 'PRO', background: '#fbe8ee', accent: '#cc527f', photo: '#f3d5df', description: '꽃잎을 담은 특별 두루마리', art: illustration(`<circle cx="180" cy="90" r="65" fill="#fff7f1" stroke="#e7aac0" stroke-width="5"/><image href="${pinkFlowerImage}" x="130" y="40" width="100" height="100"/><image href="${pinkFlowerImage}" x="25" y="10" width="20" height="20" opacity=".45"/><image href="${pinkFlowerImage}" x="306" y="146" width="26" height="26" opacity=".45"/>`, '#f9e1e9') },
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
