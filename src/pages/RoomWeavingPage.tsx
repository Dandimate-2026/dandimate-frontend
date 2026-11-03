import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { createReply, getJob, getScroll, retryWeave, transcribeReply } from '../api/memories'
import { getRoomHome } from '../api/rooms'
import type { RoomHome, Scroll, ScrollParagraph } from '../api/types'
import ContributionSheet from '../features/memories/ContributionSheet'
import { WeavingPage } from '../features/memories/CompletionPages'
import LiveScrollPage from '../features/memories/LiveScrollPage'
import type { MemoryContribution } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

function RoomWeavingPage() {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const token = session?.memberAccessToken ?? ''
  const [jobId, setJobId] = useState(params.get('job'))
  const [home, setHome] = useState<RoomHome | null>(null)
  const [scroll, setScroll] = useState<Scroll | null>(null)
  const [replyTarget, setReplyTarget] = useState<ScrollParagraph | null>(null)
  const [error, setError] = useState('')
  const [failedWeave, setFailedWeave] = useState(false)
  const [replyNotice, setReplyNotice] = useState('')

  const refresh = useCallback(async () => {
    const result = await getScroll(roomId, token)
    setScroll(result)
  }, [roomId, token])

  useEffect(() => {
    let active = true
    let checking = false
    async function check() {
      if (checking) return
      checking = true
      try {
        const room = await getRoomHome(roomId, token)
        if (active) setHome(room)
        if (jobId) {
          const job = await getJob(jobId, token)
          if (job.status === 'FAILED') {
            if (active) {
              setFailedWeave(job.type === 'WEAVE_SCROLL')
              setError(`${job.type === 'REPLY_REWEAVE' ? '답가 반영' : '엮기'} 작업에 실패했어요${job.errorCode ? ` (${job.errorCode})` : ''}.`)
            }
            return
          }
          if (job.status !== 'SUCCEEDED' && room.room.status !== 'GROWING') return
        }
        const result = await getScroll(roomId, token)
        if (active) { setScroll(result); setError(''); setFailedWeave(false); setReplyNotice('') }
      } catch (cause) {
        if (active && !(cause instanceof ApiError && cause.status === 409)) setError(cause instanceof Error ? cause.message : '두루마리를 불러오지 못했어요.')
      } finally { checking = false }
    }
    void check()
    const interval = window.setInterval(() => void check(), 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [roomId, token, jobId])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  const backToHome = () => navigate(paths.roomHome(roomId))

  async function retry() {
    setError(''); setFailedWeave(false)
    try { const result = await retryWeave(roomId, token); setJobId(result.job.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '다시 엮기를 시작하지 못했어요.') }
  }

  async function saveReply(value: MemoryContribution) {
    if (!replyTarget) return
    const body = value.audioBlob && value.transcriptionId
      ? { inputMode: 'VOICE' as const, transcriptionId: value.transcriptionId, transcript: value.text }
      : { inputMode: 'TEXT' as const, transcript: value.text }
    const result = await createReply(replyTarget.id, token, body)
    if (value.audioUrl) URL.revokeObjectURL(value.audioUrl)
    setJobId(result.job.id)
    setReplyNotice('답가를 반영하고 있어요. 완료되면 두루마리가 갱신돼요.')
    setReplyTarget(null)
  }

  return <div className="memory-app w-full">
    {scroll && home ? <>
      {replyNotice && <p className="memory-error" role="status">{replyNotice}</p>}
      {error && <p className="memory-error" role="alert">{error}</p>}
      <LiveScrollPage scroll={scroll} home={home} token={token} onBack={backToHome} onReply={setReplyTarget} onRefresh={refresh} />
    </> : <WeavingPage onBack={backToHome} onReady={() => {}} autoReady={false} title={home?.room.name ?? session.roomName ?? '두루마리'} error={error} onRetry={home?.me.role === 'HOST' && failedWeave ? () => void retry() : undefined} />}
    {replyTarget && <ContributionSheet kind="reply" quote={replyTarget.body} maxLength={200}
      onTranscribe={(audio) => transcribeReply(replyTarget.id, token, audio)}
      onSave={saveReply} onClose={() => setReplyTarget(null)} />}
  </div>
}

export default RoomWeavingPage
