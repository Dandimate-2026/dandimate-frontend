import { useState } from 'react'
import { useNavigate } from 'react-router'
import { askHost } from '../../hooks/useRoomQuota'
import { paths } from '../../routes/paths'
import { rememberPlanReturn } from '../../lib/planReturn'
import type { RoomHome, Scroll } from '../../api/types'
import Button from '../../components/Button'
import { MemoryHeader } from './components'
import ScrollDocument from './ScrollDocument'
import { canUseTemplate, getTemplate, saveTemplate, SCROLL_TEMPLATES, type RoomPlan, type ScrollTemplateId } from './templates'

const PLAN_LABEL: Record<RoomPlan, string> = { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' }
const planBadge = (plan: RoomPlan) => (plan === 'FREE' ? '무료' : plan === 'LITE' ? 'LITE+' : 'PRO')

/** 모임 장소(주소·장소 이름)나 방 이름에 지역 이름이 들어 있으면 그 지역 템플릿을 추천한다 (예: "경북 경주시 …" → 경주) */
function recommendFor(...texts: (string | null | undefined)[]): ScrollTemplateId | null {
  for (const text of texts) {
    if (!text) continue
    const region = SCROLL_TEMPLATES.find((item) => item.plan === 'LITE' && text.includes(item.name))
    if (region) return region.id
  }
  return null
}

export default function TemplatePicker({ scroll, home, value, onSelect, onClose }: {
  scroll: Scroll; home: RoomHome; value: ScrollTemplateId; onSelect: (id: ScrollTemplateId) => void; onClose: () => void
}) {
  const recommended = recommendFor(home.room.place?.address, home.room.place?.placeName, home.room.name)
  const [selected, setSelected] = useState<ScrollTemplateId>(value === 'minimal' && recommended ? recommended : value)
  const [preview, setPreview] = useState(false)
  const [asked, setAsked] = useState(false)
  const navigate = useNavigate()
  const isHost = home.me.role === 'HOST'
  const template = getTemplate(selected)
  const plan = (home.room.planType ?? 'FREE') as RoomPlan
  const allowed = canUseTemplate(selected, plan)
  const storyCount = new Set(scroll.paragraphs.flatMap((paragraph) => paragraph.sources.map((source) => source.entryId))).size
  const lockNote = allowed ? null : `${template.name} 템플릿은 ${PLAN_LABEL[template.plan]} 이상 플랜에서 쓸 수 있어요 · 지금은 ${PLAN_LABEL[plan]}`
  const featured = getTemplate(recommended ?? selected)

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

  if (preview) {
    return <main className="memory-page template-picker">
      <MemoryHeader title="미리보기" onBack={() => setPreview(false)} />
      <div className="template-document-preview"><ScrollDocument scroll={scroll} home={home} template={selected} /></div>
      <div className="template-chips" aria-label="템플릿 바꿔 보기">{SCROLL_TEMPLATES.map((item) => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><img src={item.art} alt="" />{item.name}</button>)}</div>
      <p className="template-note">이 기기에서 고른 템플릿으로 보여요{template.plan !== 'FREE' && ` · ${template.name}는 ${PLAN_LABEL[template.plan]} 이상`}</p>
      {allowed ? <Button onClick={() => onSelect(selected)}>이걸로 펼치기</Button>
        // 플랜을 올리러 가기 전에 고른 템플릿을 기억해 둔다. 플랜이 올라가면 다시 고르지 않아도 이 템플릿으로 펼쳐진다.
        // 결제를 마치면 방 홈이 아니라 이 두루마리로 돌아온다
        : isHost ? <Button onClick={() => { saveTemplate(home.room.id, selected); rememberPlanReturn(home.room.id, window.location.pathname + window.location.search); navigate(paths.roomPlan(home.room.id)) }}>{PLAN_LABEL[template.plan]} 플랜 보기</Button>
        : <Button onClick={() => { saveTemplate(home.room.id, selected); void askHost(`방장님, ${home.room.name} 두루마리를 ${template.name} 템플릿으로 펼쳐 보고 싶어요. ${PLAN_LABEL[template.plan]} 플랜으로 바꿔 줄 수 있을까요?`); setAsked(true) }}>{asked ? '방장에게 부탁했어요' : '방장에게 플랜 부탁하기'}</Button>}
    </main>
  }

  return <main className="memory-page template-picker tp">
    <div className="template-picker-top">
      <MemoryHeader title={home.room.name} onBack={onClose} />
      <button type="button" className="template-later" onClick={onClose}>나중에</button>
    </div>
    <p className="tp-eyebrow">✓ 이야기 {storyCount}개가 엮였어요</p>
    <h1 className="tp-title">어떤 두루마리로<br />펼쳐 볼까요?</h1>
    <p className="tp-sub">언제든 다시 바꿀 수 있어요</p>

    <button type="button" className="tp-featured" aria-pressed={selected === featured.id} onClick={() => setSelected(featured.id)}>
      <span className="tp-featured-art">
        <img src={featured.art} width={360} height={240} alt="" />
        {recommended && <span className="tp-reco">추천</span>}
      </span>
      <span className="tp-featured-body">
        <span className="tp-featured-name">{featured.name}<span className={`tp-badge inline ${featured.plan.toLowerCase()}`}>{planBadge(featured.plan)}</span></span>
        <span className="tp-featured-desc">{featured.description}</span>
        {recommended && <span className="tp-featured-why">{home.room.place ? '모임 장소' : '장소'}가 {featured.name}라서 추천해요</span>}
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

    <div className="tp-footer">
      <p className="tp-note">{lockNote ?? `${template.name} 템플릿으로 펼쳐요`}</p>
      <Button onClick={() => { setPreview(true); window.scrollTo(0, 0) }}>{template.name}로 펼치기</Button>
    </div>
  </main>
}
