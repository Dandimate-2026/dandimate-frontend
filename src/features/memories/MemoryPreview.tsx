import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Button from '../../components/Button'
import CirculationPage from './CirculationPage'
import ContributionSheet from './ContributionSheet'
import { CirculationComplete, WeavingPage } from './CompletionPages'
import ScrollPage from './ScrollPage'
import { MemoryFlower, PhotoSlot, TripHeading } from './components'
import { MEMORY_PHOTOS, PREVIEW_SCREENS } from './data'
import type { MemoryContribution, MemoryResponse, PreviewScreen } from './types'

function readScreen(): PreviewScreen {
  const value = window.location.hash.slice(1)
  return PREVIEW_SCREENS.some((screen) => screen.id === value) ? value as PreviewScreen : 'screens'
}
function subscribeScreen(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function PreviewIndex() {
  return <main className="memory-preview-index">
    <MemoryFlower color="pink" size={48} /><p className="memory-preview-eyebrow">두루두루</p><h1>함께 모은 기억,<br />하나의 두루마리로.</h1>
    <p className="memory-preview-description">화면을 골라 직접 둘러보세요.<br />새로고침하면 시안의 처음 상태로 돌아가요.</p>
    <nav aria-label="화면 미리보기">{PREVIEW_SCREENS.map((screen) => <a href={`#${screen.id}`} key={screen.id}><span className="memory-screen-number">{screen.id.toUpperCase()}</span><span><strong>{screen.title}</strong><small>{screen.detail}</small></span></a>)}</nav>
    <p className="memory-preview-footnote">UI 미리보기 · 입력 내용은 서버에 전송되지 않아요.<br />사진·음성 원본과 AI 연동은 포함되지 않았어요.</p>
  </main>
}

function initialResponses(screen: PreviewScreen): Record<string, MemoryResponse> {
  if (screen === 's6-3') return { observatory: { status: 'added', contribution: { text: '그거 사실 내가 일부러 앉은거임' } } }
  if (screen === 's6-4') return { park: { status: 'passed' } }
  if (screen === 's6-5') return { observatory: { status: 'added' }, park: { status: 'added' }, evening: { status: 'added' }, 'last-cafe': { status: 'passed' } }
  return {}
}

function MemoryExperience({ initialScreen }: { initialScreen: PreviewScreen }) {
  const [view, setView] = useState<PreviewScreen>(initialScreen)
  const [index, setIndex] = useState(initialScreen === 's6-4' ? 2 : 1)
  const [responses, setResponses] = useState(() => initialResponses(initialScreen))
  const [textOnly, setTextOnly] = useState(false)
  const [additionOpen, setAdditionOpen] = useState(initialScreen === 's6-2')
  const [replyTarget, setReplyTarget] = useState<{ chapter: string; quote: string } | null>(initialScreen === 's10' ? { chapter: 'observatory', quote: '첨성대 앞에서 한참을 웃었지.\n사진은 없지만 그날 바람도 참 좋았어.' } : null)
  const [replies, setReplies] = useState<Record<string, MemoryContribution[]>>({})
  const audioUrls = useRef<Set<string>>(new Set())
  useEffect(() => { const urls = audioUrls.current; return () => urls.forEach((url) => URL.revokeObjectURL(url)) }, [])
  const showScroll = useCallback(() => { setView('s9'); window.scrollTo(0, 0) }, [])

  const photo = MEMORY_PHOTOS[index]
  const response = responses[photo.id]
  function home() { window.location.hash = 'screens' }
  function next() {
    setAdditionOpen(false)
    if (index === MEMORY_PHOTOS.length - 1) setView('s6-5')
    else { setIndex((current) => current + 1); setView('s6-1') }
    window.scrollTo(0, 0)
  }
  function saveAddition(contribution: MemoryContribution) {
    if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
    setResponses((current) => ({ ...current, [photo.id]: { status: 'added', contribution } }))
    setAdditionOpen(false)
    setView('s6-3')
  }

  const isScroll = view === 's9' || view === 's10'
  return <>
    {view === 's6-5' ? <CirculationComplete addedCount={Object.values(responses).filter((entry) => entry.status === 'added').length} photoCount={MEMORY_PHOTOS.length - 1} onBack={() => setView('s6-1')} onHome={home} />
      : view === 's8' ? <WeavingPage onBack={home} onReady={showScroll} />
      : isScroll ? <ScrollPage onBack={home} replies={replies} onReply={(chapter, quote) => setReplyTarget({ chapter, quote })} />
      : view === 's6-2' ? <main className="memory-page memory-scroll"><TripHeading onBack={home} /><div className="memory-sheet-preview-photo"><PhotoSlot label="황리단길 카페" /></div><Button className="memory-reopen-sheet" onClick={() => setAdditionOpen(true)}>덧붙이기</Button></main>
      : <CirculationPage photo={photo} position={index + 1} total={MEMORY_PHOTOS.length} response={response} textOnly={textOnly} onTextMode={setTextOnly} onBack={home} onAdd={() => setAdditionOpen(true)} onPass={() => { setResponses((current) => ({ ...current, [photo.id]: { status: 'passed' } })); setView('s6-4') }} onNext={next} />}
    {additionOpen && <ContributionSheet kind="addition" quote={photo.firstStory.text} initial={response?.contribution} startWithText={textOnly} onSave={saveAddition} onClose={() => setAdditionOpen(false)} />}
    {replyTarget && <ContributionSheet kind="reply" quote={replyTarget.quote} onClose={() => setReplyTarget(null)} onSave={(contribution) => {
      if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
      setReplies((current) => ({ ...current, [replyTarget.chapter]: [...(current[replyTarget.chapter] ?? []), contribution] }))
      setReplyTarget(null)
      setView('s9')
    }} />}
  </>
}

export default function MemoryPreview() {
  const screen = useSyncExternalStore(subscribeScreen, readScreen, () => 'screens' as PreviewScreen)
  return <div className="memory-app">{screen === 'screens' ? <PreviewIndex /> : <MemoryExperience key={screen} initialScreen={screen} />}</div>
}
