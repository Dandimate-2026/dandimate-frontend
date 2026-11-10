import { useAppNavigate } from '../hooks/useAppNavigate'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import type { ReviewerDemo } from '../api/reviewerDemo'
import { ApiError } from '../api/client'
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
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'

function RoomWeavingPage() {
  const location = useLocation()
  const reviewerDemo = (location.state as { reviewerDemo?: ReviewerDemo } | null)?.reviewerDemo
  const { roomId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const updateJobParam = useCallback((id: string | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('job', id)
      else next.delete('job')
      return next
    }, { replace: true, state: location.state })
  }, [setParams, location.state])
  const navigate = useAppNavigate()
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
  // 예전 챗봇 링크는 문단 위치만 안내한다. 재엮기는 문단 메뉴·전체 평가에서 시작한다.
  const replyPhotoId = params.get('reply')
  const replyOpened = useRef(false)
  const showScroll = useCallback((result: Scroll) => {
    setScroll(result)
    if (!replyPhotoId || replyOpened.current) return
    replyOpened.current = true
    const paragraph = result.paragraphs.find((p) => p.photo.id === replyPhotoId)
    if (paragraph) {
      setReplyNotice('고칠 문단 아래 ‘다시 엮기’ 버튼을 눌러 주세요.')
      // 문단이 그려진 다음 해당 사진 위치로 이동한다.
      window.setTimeout(() => {
        document.getElementById(`paragraph-${paragraph.id}`)?.scrollIntoView({ block: 'start' })
      }, 100)
    }
    else setReplyNotice('그 사진의 문단을 찾지 못했어요. 두루마리에서 직접 골라 주세요')
  }, [replyPhotoId])
  useEffect(() => {
    if (!replyNotice || jobId) return
    const timer = window.setTimeout(() => setReplyNotice(''), 12_000)
    return () => window.clearTimeout(timer)
  }, [replyNotice, jobId])

  // 재엮기 횟수를 다 썼을 때 띄우는 시트
  const [reweaveLimitOpen, setReweaveLimitOpen] = useState(false)
  const [voiceLimitOpen, setVoiceLimitOpen] = useState(false)
  const voicePlan = usePlanLimitAction(roomId, home, 'VOICE', setReplyNotice)
  const reweavePlan = usePlanLimitAction(roomId, home, 'REWEAVE', setReplyNotice)

  const refresh = useCallback(async () => {
    const [result, currentHome] = await Promise.all([getScroll(roomId, token), getRoomHome(roomId, token)])
    setHome(currentHome)
    showScroll(result)
  }, [roomId, token, showScroll])
  useRoomLiveUpdates(roomId, session?.memberAccessToken, () => {
    if (jobId) return
    void refresh().catch(() => {})
  })

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
              setError(`${job.type === 'REPLY_REWEAVE' ? '재엮기' : '엮기'} 작업에 실패했어요${job.errorCode ? ` (${job.errorCode})` : ''}.`)
            }
            return
          }
          // 이미 GROWING인 방도 답가 작업이 성공할 때까지 완료로 처리하지 않는다.
          if (job.status !== 'SUCCEEDED') return
        }
        const result = await getScroll(roomId, token)
        if (active) {
          showScroll(result); setError(''); setFailedWeave(false)
          if (jobId) {
            if (pendingParagraph) {
              const updated = result.paragraphs.find((paragraph) => paragraph.id === pendingParagraph.id)
              if (updated) setReweaveResult({ paragraphId: pendingParagraph.id, version: updated.version, previous: pendingParagraph, reply: { member: room.me, text: pendingContribution } })
              const quota = room.room.quota
              const remaining = quota?.regenerationsRemaining
              const limit = quota?.regenerationLimit
              setReplyNotice(`재엮기가 완료됐어요${remaining !== undefined ? ` · 재엮기 ${remaining}${limit !== undefined ? `/${limit}` : ''}회 남음` : ''}`)
              setPendingParagraph(null)
              window.scrollTo(0, 0)
            } else setReplyNotice('')
            setJobId(null)
            updateJobParam(null)
          }
        }
      } catch (cause) {
        if (active && cause instanceof ApiError && cause.status === 409 && !jobId) setError('엮을 게 없어요. 사진과 이야기를 먼저 남겨 주세요.')
        else if (active) setError(cause instanceof Error ? cause.message : '두루마리를 불러오지 못했어요.')
      } finally { checking = false }
    }
    void check()
    const interval = window.setInterval(() => void check(), 5000)
    return () => { active = false; window.clearInterval(interval) }
  }, [roomId, token, jobId, jobFailed, pendingParagraph, pendingContribution, updateJobParam, showScroll])

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  const backToHome = () => navigate(reviewerDemo ? paths.roomList() : paths.roomHome(roomId), { state: reviewerDemo ? { reviewerDemo } : null })

  /** 문단 메뉴와 낮은 전체 평가가 같은 문단 재엮기 화면으로 이어진다. */
  function startReweave(paragraph: ScrollParagraph) {
    if (!home || (jobId && !jobFailed)) return
    if (home.room.quota?.regenerationsRemaining === 0) { setReweaveLimitOpen(true); return }
    setError('')
    setReweaving(true)
    setReplyTarget(paragraph)
    window.scrollTo(0, 0)
  }

  async function retry() {
    setError(''); setFailedWeave(false)
    try { const result = await retryWeave(roomId, token); setJobId(result.job.id); setJobFailed(false); updateJobParam(result.job.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '다시 엮기를 시작하지 못했어요.') }
  }

  /** 답가 받아쓰기. 방 전체 말하기 시간을 다 썼으면 말하기 시트를 띄우고 글로 남기게 한다 */
  async function transcribeReplyWithLimit(audio: Blob) {
    if (!replyTarget) throw new Error('다시 엮을 문단이 없어요.')
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
    setReplyNotice('보탠 이야기로 다시 엮고 있어요. 완료되면 두루마리가 갱신돼요.')
    setReplyTarget(null)
    window.scrollTo(0, 0)
  }

  return <div className="memory-app w-full">

    {reweaving && replyTarget ? null : jobId && pendingParagraph && !jobFailed ? <WeavingPage onBack={backToHome} title={home?.room.name} reweavingCount={1} remaining={home?.room.quota?.regenerationsRemaining} limit={home?.room.quota?.regenerationLimit} photoCount={scroll?.paragraphs.length} participantDetail={scroll ? `${scroll.participantCount}/${scroll.memberCount}` : undefined} error={error} /> : scroll && home ? <>
      {error && <p className="memory-error" role="alert">{error}</p>}
      <LiveScrollPage key={`${home.room.id}:${home.me.id}`} scroll={scroll} home={home} token={token} onBack={backToHome}
        onRefresh={refresh}
        onReweaveLimit={() => setReweaveLimitOpen(true)}
        onReweave={startReweave}
        pendingParagraphId={jobId && !jobFailed ? pendingParagraph?.id ?? scroll.paragraphs[0]?.id : undefined} reweaveResult={reweaveResult}
        completionMessage={!jobId ? replyNotice : ''} onDismissCompletion={() => setReplyNotice('')} />
    </> : <WeavingPage onBack={backToHome} title={home?.room.name ?? session?.roomName ?? '두루마리'} error={error} onRetry={home?.me.role === 'HOST' && failedWeave ? () => void retry() : undefined} />}
    {replyTarget && <ContributionSheet kind="reply" quote={replyTarget.body} draftKey={reweaving ? undefined : `reply:${replyTarget.id}`} maxLength={200} maxVoiceMs={voiceMaxMs(home?.room.quota, 'other')} startWithText={reweaving} fullPage={reweaving}
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
        title="재엮기를 모두 사용했어요"
        description={<>현재 두루마리는 그대로 볼 수 있어요.<br />{home?.room.planType === 'PRO' ? '이 방에서 이용할 수 있는 최대 재엮기 횟수를 모두 썼어요.' : '다시 엮으려면 재엮기 횟수가 있는 플랜이 필요해요.'}</>}
        usage={home?.room.quota?.regenerationLimit ? {
          label: '재엮기',
          value: `${home.room.quota.regenerationCount ?? home.room.quota.regenerationLimit}/${home.room.quota.regenerationLimit}회`,
          ratio: (home.room.quota.regenerationCount ?? home.room.quota.regenerationLimit) / home.room.quota.regenerationLimit,
        } : undefined}
        currentPlan={home?.room.planType}
        onSelectPlan={reweavePlan.onSelectPlan}
        primary={{ ...reweavePlan.action, onClick: () => { setReweaveLimitOpen(false); reweavePlan.action.onClick() } }}
        secondary={{ label: '다음에 할게요', onClick: () => setReweaveLimitOpen(false) }}
        onClose={() => setReweaveLimitOpen(false)}
      />
    )}
  </div>
}

export default RoomWeavingPage
