import { useAppNavigate } from '../hooks/useAppNavigate'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { getMyAskbacks, getNextAskback, runAskbackAnalysis } from '../api/askbacks'
import { getJob } from '../api/memories'
import type { Askback, AskbackQueue, AskbackStatus } from '../api/types'
import Button from '../components/Button'
import { useRoomHomeForQuota } from '../hooks/useRoomQuota'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'

const STATUS: Record<AskbackStatus, string> = {
  PENDING: '답변 기다리는 중', ANSWERED: '답변 완료', FORGOT: '기억 안 나요',
  SKIPPED: '건너뛴 질문', EXPIRED: '기간 종료', CANCELLED: '종료된 질문',
}

export default function RoomAskbacksPage() {
  const { roomId = '' } = useParams()
  const navigate = useAppNavigate()
  const token = getRoomSession(roomId)?.memberAccessToken
  const home = useRoomHomeForQuota(roomId, token)
  const [items, setItems] = useState<Askback[] | null>(null)
  const [queue, setQueue] = useState<AskbackQueue | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [jobId, setJobId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    if (token === undefined) return
    const current = ++sequence.current
    try {
      const [list, next] = await Promise.all([getMyAskbacks(roomId), getNextAskback(roomId)])
      if (current !== sequence.current) return
      setItems(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setQueue(next); setError('')
    } catch (cause) {
      if (current === sequence.current) setError(cause instanceof Error ? cause.message : '질문을 불러오지 못했어요')
    }
  }, [roomId, token])
  useEffect(() => {
    let active = true
    const requestState = sequence
    void Promise.resolve().then(() => { if (active) return reload() })
    return () => { active = false; requestState.current++ }
  }, [reload])
  useRoomLiveUpdates(roomId, token, () => { void reload() })

  useEffect(() => {
    if (!jobId) return
    let active = true
    let checking = false
    const check = async () => {
      if (checking) return
      checking = true
      try {
        const job = await getJob(jobId, token ?? '')
        if (!active) return
        if (job.status === 'FAILED') { setError('질문을 만들지 못했어요. 다시 시도해 주세요'); setJobId(null) }
        if (job.status === 'SUCCEEDED') { setNotice('질문 확인이 끝났어요'); setJobId(null); void reload() }
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : '작업 상태를 확인하지 못했어요'); setJobId(null) }
      } finally { checking = false }
    }
    void check()
    const timer = setInterval(() => void check(), 2000)
    return () => { active = false; clearInterval(timer) }
  }, [jobId, token, reload])

  const runAnalysis = async () => {
    if (running || jobId) return
    setRunning(true); setError(''); setNotice('')
    try {
      const result = await runAskbackAnalysis(roomId)
      setJobId(result.job.id)
      setNotice('사진과 이야기를 읽고 질문을 준비하고 있어요')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '질문 생성을 요청하지 못했어요') }
    finally { setRunning(false) }
  }
  const visible = items?.filter(item => filter === 'all' || item.status === 'PENDING')
  return <main className="flex min-h-dvh flex-col bg-bg px-5 pt-14 pb-8 text-ink">
    <button type="button" className="self-start py-2 text-sm" onClick={() => navigate(paths.roomHome(roomId))}>← 방으로 돌아가기</button>
    <h1 className="mt-4 text-xl font-bold">나에게 온 질문</h1>
    {queue && <p className="mt-2 text-sm text-sub" role="status">{queue.completed ? '지금 답할 질문을 모두 마쳤어요' : `답할 질문 ${queue.remainingCount}개가 남았어요`}</p>}
    {queue?.nextAskback && <Button className="mt-4" onClick={() => navigate(paths.askback(roomId, queue.nextAskback!.id))}>다음 질문에 답하기</Button>}
    <div className="mt-5 flex gap-2" aria-label="질문 필터">
      <button type="button" aria-pressed={filter === 'pending'} className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => setFilter('pending')}>답할 질문</button>
      <button type="button" aria-pressed={filter === 'all'} className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => setFilter('all')}>전체 질문</button>
    </div>
    {error && <div className="mt-4 text-sm text-point" role="alert">{error}<button type="button" className="ml-3 underline" onClick={() => void reload()}>다시 불러오기</button></div>}
    {notice && <p className="mt-3 text-sm text-sub" role="status">{notice}</p>}
    {!items && !error && <p className="mt-6 text-sm text-sub" role="status">질문을 불러오는 중이에요</p>}
    {visible?.length === 0 && <p className="mt-8 text-sm text-sub">{filter === 'pending' ? '지금 답할 질문이 없어요' : '아직 받은 질문이 없어요'}</p>}
    <ul className="mt-4 flex flex-col gap-3">
      {visible?.map(item => <li key={item.id} className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs text-sub">{STATUS[item.status]} · {item.photo.uploader.nickname}님의 사진</p>
        <p className="mt-2 font-semibold">{item.question}</p>
        {item.status === 'PENDING' && <button type="button" className="mt-3 text-sm text-point" onClick={() => navigate(paths.askback(roomId, item.id))}>답하러 가기 →</button>}
      </li>)}
    </ul>
    {import.meta.env.DEV && home?.me.role === 'HOST' && <div className="mt-8 border-t border-line pt-4">
      <p className="mb-2 text-xs text-sub">데모에서 질문 생성 흐름을 확인할 수 있어요</p>
      <Button variant="outline" disabled={running || Boolean(jobId)} onClick={() => void runAnalysis()}>{running || jobId ? '질문 준비 중…' : '데모 질문 생성'}</Button>
    </div>}
  </main>
}
