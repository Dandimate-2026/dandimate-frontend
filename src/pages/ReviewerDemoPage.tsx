import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { activateReviewerDemo, type ReviewerDemo } from '../api/reviewerDemo'
import Button from '../components/Button'
import Flower from '../components/Flower'
import { paths } from '../routes/paths'

export default function ReviewerDemoPage() {
  const [demo, setDemo] = useState<ReviewerDemo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function activate() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { setDemo(await activateReviewerDemo()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '체험 방을 준비하지 못했어요. 다시 시도해 주세요.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <main className="flex min-h-dvh flex-col bg-bg px-6 py-8 text-ink">
    <Link to={paths.roomList()} className="self-start text-sm text-sub">‹ 내 모임방</Link>
    <div className="mt-12"><Flower code="AZALEA" size={48} /></div>
    <h1 className="mt-6 text-2xl font-bold">두루두루 체험하기</h1>
    <p className="mt-3 text-sm leading-relaxed text-sub">사진과 이야기가 담긴 예시 방에서<br />방장과 친구의 입장을 체험하고, 완성된 두루마리를 펼쳐 보세요.</p>
    {!demo && <>
      <p className="mt-6 text-sm text-sub">내 계정에 체험 방 3개가 추가돼요. 다시 시작해도 같은 방을 이어서 볼 수 있어요.</p>
      <Button className="mt-6 w-full" disabled={busy} onClick={() => void activate()}>{busy ? '체험 방을 준비하고 있어요…' : '체험 방 열기'}</Button>
    </>}
    {error && <p className="mt-4 text-sm text-point" role="alert">{error}</p>}
    {demo && <nav className="mt-8 flex flex-col gap-3" aria-label="심사용 체험 방">
      {[
        { title: '방장으로 체험하기', detail: '경주 가을 산책 · 사진과 이야기 모으기', to: paths.roomHome(demo.hostRoomId) },
        { title: '친구로 체험하기', detail: '포항 바다의 밤 · 친구 사진에 이야기 보태기', to: paths.roomHome(demo.memberRoomId) },
        { title: '완성된 두루마리 보기', detail: '안동 하루 여행 · 함께 엮인 기억 펼치기', to: paths.roomWeaving(demo.completedRoomId) },
      ].map(({ title, detail, to }) => <Link key={to} to={to} className="rounded-2xl border border-line bg-surface p-5">
        <span className="block font-semibold">{title} →</span><span className="mt-2 block text-sm text-sub">{detail}</span>
      </Link>)}
    </nav>}
  </main>
}
