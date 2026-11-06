import { useState } from 'react'
import type { RoomHome, Scroll } from '../../api/types'
import Button from '../../components/Button'
import { MemoryHeader } from './components'
import ScrollDocument from './ScrollDocument'
import { canUseTemplate, getTemplate, SCROLL_TEMPLATES, type ScrollTemplateId } from './templates'

export default function TemplatePicker({ scroll, home, value, onSelect, onClose }: {
  scroll: Scroll; home: RoomHome; value: ScrollTemplateId; onSelect: (id: ScrollTemplateId) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState(value)
  const [preview, setPreview] = useState(false)
  const template = getTemplate(selected)
  const allowed = canUseTemplate(selected, home.room.planType)
  const storyCount = new Set(scroll.paragraphs.flatMap((paragraph) => paragraph.sources.map((source) => source.entryId))).size
  return <main className="memory-page template-picker">
    <MemoryHeader title={preview ? '미리보기' : home.room.name} onBack={preview ? () => setPreview(false) : onClose} />
    {preview ? <>
      <div className="template-document-preview"><ScrollDocument scroll={scroll} home={home} template={selected} /></div>
      <div className="template-chips" aria-label="템플릿 바꿔 보기">{SCROLL_TEMPLATES.map((item) => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span style={{ background: item.accent }} />{item.name}</button>)}</div>
      <p className="template-note">이 기기에서 선택한 템플릿으로 보여요.{!allowed && ` ${template.plan === 'PRO' ? 'Pro' : 'Lite'} 플랜부터 사용할 수 있어요.`}</p>
      <Button disabled={!allowed} onClick={() => onSelect(selected)}>이걸로 펼치기</Button>
    </> : <>
      <p className="template-eyebrow">✓ 이야기 {storyCount}개가 엮였어요</p>
      <h1>어떤 두루마리로<br />펼쳐 볼까요?</h1><p className="template-subtitle">언제든 다시 바꿀 수 있어요</p>
      <div className="template-featured"><img src={template.art} width={360} height={180} alt="" /><div><h2>{template.name}</h2><p>{template.description}</p><span>{template.plan === 'FREE' ? '무료' : template.plan}</span></div></div>
      <div className="template-group-title"><h2>지역 템플릿</h2><span>Lite부터</span></div>
      <div className="template-grid" aria-label="지역 템플릿">{SCROLL_TEMPLATES.filter((item) => item.plan === 'LITE').map((item) => <button className="template-tile" type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
        <img src={item.art} width={360} height={180} alt="" /><span className="template-plan lite">{item.plan}</span><strong>{item.name}</strong>
      </button>)}</div>
      <div className="template-group-title"><h2>기본 · 특별</h2><span>기본 무료 · 특별 Pro</span></div>
      <div className="template-grid" aria-label="기본 · 특별 템플릿">{SCROLL_TEMPLATES.filter((item) => item.plan !== 'LITE').map((item) => <button className="template-tile" type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
        <img src={item.art} width={360} height={180} alt="" /><span className={`template-plan ${item.plan.toLowerCase()}`}>{item.plan === 'FREE' ? '무료' : item.plan}</span><strong>{item.name}</strong>
      </button>)}</div>
      <p className="template-note">기본 미니멀은 무료 · 지역 템플릿은 Lite부터 · 화전놀이는 Pro</p>
      <Button onClick={() => { setPreview(true); window.scrollTo(0, 0) }}>{template.name} 미리보기</Button>
      <button type="button" className="memory-text-link template-later" onClick={onClose}>나중에</button>
    </>}
  </main>
}
