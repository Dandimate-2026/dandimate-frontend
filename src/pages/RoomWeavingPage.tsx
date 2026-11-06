import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import { USE_MOCK } from '../api/mock'
import { createReply, getJob, getScroll, retryWeave, transcribeReply } from '../api/memories'
import { getRoomHome } from '../api/rooms'
import type { RoomHome, Scroll, ScrollParagraph } from '../api/types'
import PlanLimitSheet, { VoiceLimitSheet } from '../components/PlanLimitSheet'
import { isLimitError, usePlanLimitAction, voiceMaxMs } from '../hooks/useRoomQuota'
import ContributionSheet from '../features/memories/ContributionSheet'
import { WeavingPage } from '../features/memories/CompletionPages'
import LiveScrollPage from '../features/memories/LiveScrollPage'
import type { MemoryContribution, ReweaveResult } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { getParagraphRating } from '../lib/paragraphRatings'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

function RoomWeavingPage() {
  const { roomId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const captureMode = import.meta.env.DEV && params.get('capture') === '1'
  const updateJobParam = useCallback((id: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('job', id)
      else next.delete('job')
      return next
    }, { replace: true })
  }, [setParams])
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const token = session?.memberAccessToken ?? ''
  const [jobId, setJobId] = useState(params.get('job'))
  const [home, setHome] = useState<RoomHome | null>(null)
  const [scroll, setScroll] = useState<Scroll | null>(null)
  const [replyTarget, setReplyTarget] = useState<ScrollParagraph | null>(null)
  const [error, setError] = useState('')
  const [failedWeave, setFailedWeave] = useState(false)
  const [jobFailed, setJobFailed] = useState(false)
  const [replyNotice, setReplyNotice] = useState('')
  const [reweaving, setReweaving] = useState(false)
  const [pendingParagraph, setPendingParagraph] = useState<ScrollParagraph | null>(null)
  const [pendingContribution, setPendingContribution] = useState('')
  const [reweaveResult, setReweaveResult] = useState<ReweaveResult>()
  useEffect(() => {
    if (!replyNotice || jobId) return
    const timer = window.setTimeout(() => setReplyNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [replyNotice, jobId])

  // 재엮기 횟수를 다 썼을 때 띄우는 시트
  const [reweaveLimitOpen, setReweaveLimitOpen] = useState(false)
  const [voiceLimitOpen, setVoiceLimitOpen] = useState(false)
  const voicePlan = usePlanLimitAction(roomId, home, 'VOICE', setReplyNotice)
  const reweavePlan = usePlanLimitAction(roomId, home, 'REWEAVE', setReplyNotice)

  const refresh = useCallback(async () => {
    const result = await getScroll(roomId, token)
    setScroll(result)
  }, [roomId, token])

  useEffect(() => {
    if (jobFailed) return
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
              setJobFailed(true)
              setError(`${job.type === 'REPLY_REWEAVE' ? '답가 반영' : '엮기'} 작업에 실패했어요${job.errorCode ? ` (${job.errorCode})` : ''}.`)
            }
            return
          }
          // 이미 GROWING인 방도 답가 작업이 성공할 때까지 완료로 처리하지 않는다.
          if (job.status !== 'SUCCEEDED') return
        }
        const result = await getScroll(roomId, token)
        if (active) {
          setScroll(result); setError(''); setFailedWeave(false)
          if (jobId) {
            if (pendingParagraph) {
              const updated = result.paragraphs.find((paragraph) => paragraph.id === pendingParagraph.id)
              if (updated) setReweaveResult({ paragraphId: pendingParagraph.id, version: updated.version, previous: pendingParagraph, reply: { member: room.me, text: pendingContribution } })
              const quota = room.room.quota
              const remaining = quota?.regenerationsRemaining
              const limit = quota?.regenerationLimit
              setReplyNotice(`답가가 문단에 엮였어요${remaining !== undefined ? ` · 재엮기 ${remaining}${limit !== undefined ? `/${limit}` : ''}회 남음` : ''}`)
              setPendingParagraph(null)
              window.scrollTo(0, 0)
            } else setReplyNotice('')
            setJobId(null)
            updateJobParam(null)
          }
        }
      } catch (cause) {
        if (active && !(cause instanceof ApiError && cause.status === 409)) setError(cause instanceof Error ? cause.message : '두루마리를 불러오지 못했어요.')
      } finally { checking = false }
    }
    void check()
    const interval = window.setInterval(() => void check(), 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [roomId, token, jobId, jobFailed, pendingParagraph, pendingContribution, updateJobParam])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  const backToHome = () => navigate(paths.roomHome(roomId))

  async function retry() {
    setError(''); setFailedWeave(false)
    try { const result = await retryWeave(roomId, token); setJobId(result.job.id); setJobFailed(false); updateJobParam(result.job.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '다시 엮기를 시작하지 못했어요.') }
  }

  /** 답가 받아쓰기. 방 전체 말하기 시간을 다 썼으면 말하기 시트를 띄우고 글로 남기게 한다 */
  async function transcribeReplyWithLimit(audio: Blob) {
    if (!replyTarget) throw new Error('답가를 남길 문단이 없어요.')
    if (home?.room.quota?.voiceRemainingMs === 0) {
      setVoiceLimitOpen(true)
      throw new Error('말하기 시간을 모두 썼어요. 글로 남겨 주세요.')
    }
    try {
      return await transcribeReply(replyTarget.id, token, audio)
    } catch (cause) {
      if (isLimitError(cause)) {
        setVoiceLimitOpen(true)
        throw new Error('말하기 시간을 모두 썼어요. 글로 남겨 주세요.', { cause })
      }
      throw cause
    }
  }

  async function saveReply(value: MemoryContribution) {
    if (!replyTarget) return
    if (jobId && !jobFailed) throw new Error('진행 중인 엮기가 끝난 뒤 다시 남겨 주세요.')
    if (reweaving) {
      const rating = home ? getParagraphRating(roomId, home.me.id, replyTarget.id, replyTarget.version) : undefined
      if (rating === undefined || rating > 2) throw new Error('1~2점으로 평가한 문단만 다시 엮을 수 있어요.')
    }
    const body = value.audioBlob && value.transcriptionId
      ? { inputMode: 'VOICE' as const, transcriptionId: value.transcriptionId, transcript: value.text }
      : { inputMode: 'TEXT' as const, transcript: value.text }
    // 답가는 한도 도달 후에도 원문으로 보관하고 기존 한도 안내를 유지한다.
    const outOfReweaves = home?.room.quota?.regenerationsRemaining === 0
    let result: Awaited<ReturnType<typeof createReply>>
    try {
      result = await createReply(replyTarget.id, token, body)
    } catch (cause) {
      if (!isLimitError(cause)) throw cause
      setReplyTarget(null)
      setReweaveLimitOpen(true)
      return
    }
    if (value.audioUrl) URL.revokeObjectURL(value.audioUrl)
    if (outOfReweaves) {
      setReplyTarget(null)
      setReweaveLimitOpen(true)
      return
    }
    if (!result?.job) { setReplyTarget(null); return }
    setJobId(result.job.id)
    setJobFailed(false)
    updateJobParam(result.job.id)
    setPendingParagraph(replyTarget)
    setPendingContribution(value.text)
    setError('')
    setReweaveResult(undefined)
    setReplyNotice('답가를 반영하고 있어요. 완료되면 두루마리가 갱신돼요.')
    setReplyTarget(null)
    window.scrollTo(0, 0)
  }

  return <div className="memory-app w-full">
    {USE_MOCK && !captureMode && <p className="scroll-preview-banner" role="note">기능 미리보기 · 예시 데이터</p>}
    {reweaving && jobId && pendingParagraph && !jobFailed ? <WeavingPage onBack={backToHome} onReady={() => {}} autoReady={false} title={home?.room.name} reweavingCount={1} remaining={home?.room.quota?.regenerationsRemaining} limit={home?.room.quota?.regenerationLimit} photoCount={scroll?.paragraphs.length} participantDetail={scroll ? `${scroll.participantCount}/${scroll.memberCount}` : undefined} error={error} /> : scroll && home ? <>
      {error && <p className="memory-error" role="alert">{error}</p>}
      <LiveScrollPage key={`${home.room.id}:${home.me.id}`} scroll={scroll} home={home} token={token} onBack={backToHome}
        onReply={(paragraph) => { setReweaving(false); setReplyTarget(paragraph) }} onRefresh={refresh}
        onReweave={(paragraph) => { setReweaving(true); setReplyTarget(paragraph) }}
        pendingParagraphId={jobId && !jobFailed ? pendingParagraph?.id ?? scroll.paragraphs[0]?.id : undefined} reweaveResult={reweaveResult}
        completionMessage={!jobId ? replyNotice : ''} onDismissCompletion={() => setReplyNotice('')}
        onAddStory={() => navigate(paths.photoUpload(roomId))} />
    </> : <WeavingPage onBack={backToHome} onReady={() => {}} autoReady={false} title={home?.room.name ?? session?.roomName ?? '두루마리'} error={error} onRetry={home?.me.role === 'HOST' && failedWeave ? () => void retry() : undefined} />}
    {replyTarget && <ContributionSheet kind="reply" quote={replyTarget.body} maxLength={200} maxVoiceMs={voiceMaxMs(home?.room.quota, 'other')} startWithText={reweaving}
      onTranscribe={transcribeReplyWithLimit}
      onSave={saveReply} onClose={() => setReplyTarget(null)} />}
    {voiceLimitOpen && (
      <VoiceLimitSheet
        quota={home?.room.quota}
        onWriteText={() => setVoiceLimitOpen(false)}
        planAction={{ ...voicePlan.action, onClick: () => { setVoiceLimitOpen(false); voicePlan.action.onClick() } }}
        onClose={() => setVoiceLimitOpen(false)}
      />
    )}
    {reweaveLimitOpen && (
      <PlanLimitSheet
        kind="reweave"
        title={<>이번 방의 재엮기를<br />모두 사용했어요</>}
        description={<>답가는 계속 남길 수 있고 원문으로 보관돼요.<br />두루마리 본문에는 플랜을 바꾸면 엮여요.</>}
        usage={home?.room.quota?.regenerationLimit ? {
          label: '재엮기',
          value: `${home.room.quota.regenerationCount ?? home.room.quota.regenerationLimit}회 / ${home.room.quota.regenerationLimit}회`,
          ratio: (home.room.quota.regenerationCount ?? home.room.quota.regenerationLimit) / home.room.quota.regenerationLimit,
        } : undefined}
        currentPlan={home?.room.planType}
        primary={{ ...reweavePlan.action, onClick: () => { setReweaveLimitOpen(false); reweavePlan.action.onClick() } }}
        secondary={{ label: '다음에 할게요', onClick: () => setReweaveLimitOpen(false) }}
        onClose={() => setReweaveLimitOpen(false)}
      />
    )}
  </div>
}

export default RoomWeavingPage
