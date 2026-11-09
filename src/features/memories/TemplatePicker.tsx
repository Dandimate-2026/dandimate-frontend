import { requestPlanUpgrade } from '../../api/rooms'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../../routes/paths'
import { rememberPlanReturn } from '../../lib/planReturn'
import type { RoomHome, Scroll } from '../../api/types'
import Button from '../../components/Button'
import { MemoryHeader } from './components'
import ScrollDocument from './ScrollDocument'
import { canUseTemplate, getTemplate, SCROLL_TEMPLATES, type RoomPlan, type ScrollTemplateId } from './templates'

const PLAN_LABEL: Record<RoomPlan, string> = { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' }
const planBadge = (plan: RoomPlan) => (plan === 'FREE' ? '무료' : plan === 'LITE' ? 'LITE+' : 'PRO')

export default function TemplatePicker({ scroll, home, value, onSelect, onClose }: {
  scroll: Scroll; home: RoomHome; value: ScrollTemplateId; onSelect: (id: ScrollTemplateId) => void | Promise<void>; onClose: () => void
}) {
  const [selected, setSelected] = useState<ScrollTemplateId>(value)
  const [tab, setTab] = useState<'select' | 'preview'>('select')
  const [saving, setSaving] = useState(false)
  const [asked, setAsked] = useState('')
  const [asking, setAsking] = useState(false)
  const [requestError, setRequestError] = useState('')
  const navigate = useNavigate()
  const isHost = home.me.role === 'HOST'
  const template = getTemplate(selected)
  const plan = (home.room.planType ?? 'FREE') as RoomPlan
  const allowed = canUseTemplate(selected, plan)
  const storyCount = new Set(scroll.paragraphs.flatMap((paragraph) => paragraph.sources.map((source) => source.entryId))).size
  const lockNote = allowed ? null : `${template.name} 템플릿은 ${PLAN_LABEL[template.plan]} 이상 플랜에서 쓸 수 있어요 · 지금은 ${PLAN_LABEL[plan]}`
  const featured = getTemplate(selected)
  async function requestTemplate() {
    if (asking) return
    setAsking(true); setRequestError('')
    try {
      if (!allowed) {
        await requestPlanUpgrade(home.room.id, 'REWEAVE', template.plan as 'LITE' | 'PRO')
        setAsked('방장에게 플랜 변경 요청 알림을 보냈어요.')
        return
      }
      const text = `방장님, ${home.room.name} 두루마리를 ${template.name} 템플릿으로 바꿔 보고 싶어요.${allowed ? '' : ` ${PLAN_LABEL[template.plan]} 플랜이 필요해요.`}`
      if (navigator.share) await navigator.share({ text })
      else if (navigator.clipboard) await navigator.clipboard.writeText(text)
      else throw new Error('요청 문구를 공유할 수 없어요. 브라우저에서 다시 열어 주세요.')
      setAsked(typeof navigator.share === 'function' ? '공유한 요청 문구를 방장에게 전달해 주세요.' : '요청 문구를 복사했어요. 방장에게 보내 주세요.')
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setRequestError(cause instanceof Error ? cause.message : '요청 문구를 공유하지 못했어요.')
    } finally { setAsking(false) }
  }

  const tile = (item: (typeof SCROLL_TEMPLATES)[number]) => (
    <button className="tp-tile" type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
      <span className="tp-tile-art">
        <img src={item.art} width={360} height={240} alt="" />
        <span className={`tp-badge ${item.plan.toLowerCase()}`}>{planBadge(item.plan)}</span>
      </span>
      <span className="tp-tile-name">{item.name}</span>
      {/* Pro 특별 꾸미기는 시즌 한정이라 이름 밑에 작게 알린다 */}
      {item.plan === 'PRO' && <span className="tp-tile-sub">겨울 시즌 한정</span>}
    </button>
  )

  async function apply() {
    if (saving) return
    setSaving(true); setRequestError('')
    try { await onSelect(selected) }
    catch (cause) { setRequestError(cause instanceof Error ? cause.message : '템플릿을 적용하지 못했어요.') }
    finally { setSaving(false) }
  }

  return <main className="memory-page template-picker tp">
    <div className="template-picker-top">
      <MemoryHeader title={home.room.name} onBack={onClose} />
      <button type="button" className="template-later" onClick={onClose}>나중에</button>
    </div>
    <p className="tp-eyebrow">✓ 이야기 {storyCount}개가 엮였어요</p>
    <h1 className="tp-title">우리 추억에 어울리는<br />두루마리를 골라요</h1>
    <p className="tp-sub">바로 선택하거나, 실제 이야기로 미리 볼 수 있어요</p>
    <div className="template-mode-tabs" role="tablist" aria-label="템플릿 고르기 방식">
      {([{ id: 'select', label: '템플릿 선택' }, { id: 'preview', label: '미리보기' }] as const).map(item => <button key={item.id} type="button" role="tab" id={`template-tab-${item.id}`} aria-controls={`template-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = tab === 'select' ? 'preview' : 'select'; setTab(next); document.getElementById(`template-tab-${next}`)?.focus() } }}>{item.label}</button>)}
    </div>
    <div role="tabpanel" id={`template-panel-${tab}`} aria-labelledby={`template-tab-${tab}`}>
    {tab === 'preview' ? <>
      <div className="template-chips" aria-label="템플릿 바꿔 보기">{SCROLL_TEMPLATES.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setAsked(''); setRequestError('') }}><img src={item.art} alt="" />{item.name}</button>)}</div>
      <div className="template-document-preview"><ScrollDocument scroll={scroll} home={home} template={selected} paragraph={isHost ? undefined : scroll.paragraphs[0]} /></div>
      {!isHost && <p className="template-note">미리보기에는 첫 번째 사진과 이야기를 보여드려요. 적용은 방장에게 요청해 주세요.</p>}
    </> : <>
    <button type="button" className="tp-featured" aria-pressed={selected === featured.id} onClick={() => setSelected(featured.id)}>
      <span className="tp-featured-art">
        <img src={featured.art} width={360} height={240} alt="" />
      </span>
      <span className="tp-featured-body">
        <span className="tp-featured-name">{featured.name}<span className={`tp-badge inline ${featured.plan.toLowerCase()}`}>{planBadge(featured.plan)}</span></span>
        <span className="tp-featured-desc">{featured.description}</span>
      </span>
    </button>

    <section className="tp-section">
      <div className="tp-section-head"><h2>지역 템플릿</h2><span>Lite 이상</span></div>
      <div className="tp-row" aria-label="지역 템플릿">{SCROLL_TEMPLATES.filter((item) => item.plan === 'LITE').map(tile)}</div>
    </section>
    <div className="tp-split">
      <section className="tp-section">
        <div className="tp-section-head"><h2>특별 꾸미기</h2><span>Pro 전용</span></div>
        <div className="tp-row" aria-label="특별 꾸미기 템플릿">{SCROLL_TEMPLATES.filter((item) => item.plan === 'PRO').map(tile)}</div>
      </section>
      <section className="tp-section">
        <div className="tp-section-head"><h2>기본</h2><span>무료</span></div>
        <div className="tp-row" aria-label="기본 템플릿">{SCROLL_TEMPLATES.filter((item) => item.plan === 'FREE').map(tile)}</div>
      </section>
    </div>

    </>}
    </div>
    <div className="tp-footer">
      <p className="tp-note">{lockNote ?? `${template.name} 템플릿으로 펼쳐요`}</p>
      {!isHost ? <Button disabled={asking} onClick={() => void requestTemplate()}>{asking ? '요청 중…' : '방장에게 이 템플릿 요청하기'}</Button>
        : allowed ? <Button disabled={saving} onClick={() => void apply()}>{saving ? '적용 중…' : '이 템플릿 선택하기'}</Button>
        : <Button onClick={() => { rememberPlanReturn(home.room.id, window.location.pathname + window.location.search); navigate(paths.roomPlan(home.room.id)) }}>{PLAN_LABEL[template.plan]} 플랜 보기</Button>}
      {asked && <p className="template-note" role="status">{asked}</p>}
      {requestError && <p className="memory-error" role="alert">{requestError}</p>}
    </div>
  </main>
}
