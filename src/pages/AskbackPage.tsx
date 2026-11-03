import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { answerAskback, forgetAskback, getAskback, postponeAskback, transcribeAskback } from '../api/askbacks'
import { ApiError } from '../api/client'
import type { Askback } from '../api/types'
import Button from '../components/Button'
import AnswerForm, { type VoiceDraft } from '../components/entry/AnswerForm'
import { ChevronLeftIcon, ImagePlaceholderIcon, SparkleIcon } from '../components/entry/EntryIcons'
import { RecordButton, WaveProgress } from '../components/entry/VoiceControls'
import { VoiceLimitSheet } from '../components/PlanLimitSheet'
import { isLimitError, usePlanLimitAction, useRoomHomeForQuota } from '../hooks/useRoomQuota'
import { useVoiceRecorder, type Recording } from '../hooks/useVoiceRecorder'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

// 되묻기 답은 음성 1~30초, 글 200자까지 (백엔드 명세)
const MIN_VOICE_MS = 1_000
const MAX_VOICE_MS = 30_000
const MAX_TEXT_LENGTH = 200

/**
 * 화면 상태
 * - idle · recording · transcribing · review · text: 첫 한마디 화면과 같음
 * - forgot: "기억 안 나요"를 누른 뒤
 */
type Step = 'idle' | 'recording' | 'transcribing' | 'review' | 'text' | 'forgot'

/** ["서연", "지수"] → "서연 님과 지수 님" */
function joinNicknames(names: string[]) {
  const withSuffix = names.map((name) => `${name} 님`)
  if (withSuffix.length === 2) return `${withSuffix[0]}과 ${withSuffix[1]}`
  return withSuffix.join(', ')
}

function closedMessage(err: unknown) {
  if (err instanceof ApiError && err.code === 'ASKBACK_CLOSED') return '이미 끝난 질문이에요'
  return err instanceof ApiError ? err.message : '저장하지 못했어요. 다시 시도해 주세요'
}

/** AI가 친구들의 이야기를 읽고 나에게만 묻는 질문에 답하는 화면 */
function AskbackPage() {
  const { roomId = '', askbackId = '' } = useParams()
  const navigate = useNavigate()
  const session = getRoomSession(roomId)
  const token = session?.memberAccessToken ?? ''

  const [askback, setAskback] = useState<Askback | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [transcript, setTranscript] = useState('')
  const [draft, setDraft] = useState<VoiceDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // 방 전체 말하기 시간을 다 썼을 때 띄우는 시트
  const [voiceLimitOpen, setVoiceLimitOpen] = useState(false)
  const home = useRoomHomeForQuota(roomId, session?.memberAccessToken)
  const quota = home?.room.quota
  const voicePlan = usePlanLimitAction(roomId, home, 'VOICE', setError)

  useEffect(() => {
    getAskback(askbackId, token)
      .then(setAskback)
      .catch((e: unknown) =>
        setLoadError(
          e instanceof ApiError && (e.status === 403 || e.status === 404)
            ? '질문을 찾을 수 없어요'
            : '질문을 불러오지 못했어요',
        ),
      )
  }, [askbackId, token])
  useEffect(() => () => void (draft && URL.revokeObjectURL(draft.audioUrl)), [draft])

  const handleRecorded = async ({ blob, durationMs }: Recording) => {
    if (durationMs < MIN_VOICE_MS) {
      setError('조금만 더 길게 말해 주세요')
      setStep('idle')
      return
    }
    setStep('transcribing')
    try {
      const result = await transcribeAskback(askbackId, token, blob)
      setDraft({ transcriptionId: result.transcriptionId, durationMs, audioUrl: URL.createObjectURL(blob) })
      setTranscript(result.transcript)
      setStep('review')
    } catch (e) {
      if (isLimitError(e)) {
        setStep('idle')
        setVoiceLimitOpen(true)
        return
      }
      // 받아 적기에 실패해도 글로 이어서 답할 수 있게 한다
      setError('받아 적지 못했어요. 글로 답해 주세요')
      setStep('text')
    }
  }

  const recorder = useVoiceRecorder({ maxMs: MAX_VOICE_MS, onFinish: handleRecorded })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (loadError) return <NotFoundPage message={loadError} />
  if (!askback) return <main className="flex-1 bg-bg" aria-busy="true" />
  if (askback.status !== 'PENDING') return <NotFoundPage message="이미 끝난 질문이에요" />

  const goHome = () => navigate(paths.roomHome(roomId), { replace: true })

  const handleMicClick = async () => {
    setError(null)
    // 방 전체 말하기 시간을 다 썼으면 녹음하지 않고 안내한다
    if (quota?.voiceRemainingMs === 0) {
      setVoiceLimitOpen(true)
      return
    }
    try {
      await recorder.start()
      setStep('recording')
    } catch {
      setError('마이크를 쓸 수 없어요. 글로 답해 주세요')
      setStep('text')
    }
  }

  const handleConfirm = async () => {
    const text = transcript.trim()
    if (!text || saving) return
    setSaving(true)
    setError(null)
    try {
      await answerAskback(
        askbackId,
        token,
        step === 'review' && draft
          ? { inputMode: 'VOICE', transcriptionId: draft.transcriptionId, transcript: text }
          : { inputMode: 'TEXT', transcript: text },
      )
      goHome()
    } catch (err) {
      setError(closedMessage(err))
      setSaving(false)
    }
  }

  const handleForgot = async () => {
    recorder.cancel()
    setSaving(true)
    setError(null)
    try {
      await forgetAskback(askbackId, token)
      setStep('forgot')
    } catch (err) {
      setError(closedMessage(err))
      setStep('idle')
    } finally {
      setSaving(false)
    }
  }

  const handlePostpone = async () => {
    recorder.cancel()
    try {
      await postponeAskback(askbackId, token)
    } catch {
      // 미루기가 실패해도 질문은 그대로 남아 있으니 홈으로 돌아간다
    }
    goHome()
  }

  const answering = step === 'review' || step === 'text'
  const { photo } = askback

  return (
    // 화면 높이에 맞춰 사진 영역이 늘었다 줄었다 해서, 아래 카드가 항상 한 화면에 보이게 한다
    <main className="flex h-dvh min-h-[600px] flex-col bg-bg px-5 pt-12 pb-8 text-ink">
      <button type="button" onClick={goHome} aria-label="방으로 돌아가기" className="self-start py-1 pr-2">
        <ChevronLeftIcon />
      </button>

      <header className="mt-2 px-[14px]">
        <p className="flex items-center gap-1.5 text-[11px] text-point">
          <SparkleIcon />
          AI가 물어봐요
        </p>
        <h1 className="mt-2.5 text-[20px] leading-[28px] font-bold">{askback.question}</h1>
        {askback.evidenceNicknames.length > 0 && (
          <p className="mt-2 text-[11px] text-sub">
            {joinNicknames(askback.evidenceNicknames)}의 이야기를 읽고 물어봤어요
          </p>
        )}
      </header>

      {/* 질문을 받은 사진. 시안 높이(337px, 답 확인 단계 220px)를 기본으로 하고 화면이 낮으면 줄어든다 */}
      <div
        className={`relative mt-3 flex min-h-[120px] shrink grow-0 items-center justify-center overflow-hidden rounded-xl bg-[#efe9df] ${
          answering ? 'basis-[220px]' : 'basis-[337px]'
        }`}
      >
        {photo.imageUrl ? (
          <img src={photo.imageUrl} alt={`${photo.uploader.nickname} 님 사진`} className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-[11px] text-sub">
            <ImagePlaceholderIcon />
            사진
          </div>
        )}
        {/* 사진 위에서도 읽히도록 옅은 바탕을 깐다 */}
        <span className="absolute top-2 right-2.5 rounded-full bg-bg/80 px-2 py-0.5 text-[11px] text-sub">
          {photo.uploader.nickname} 님 사진
        </span>
      </div>

      {answering ? (
        <section className="flex flex-1 flex-col pt-2">
          <AnswerForm
            transcript={transcript}
            maxLength={MAX_TEXT_LENGTH}
            voice={step === 'review' ? draft : null}
            error={error}
            saving={saving}
            confirmLabel="이렇게 답하기"
            onChange={setTranscript}
            onRetry={() => {
              setDraft(null)
              setTranscript('')
              setError(null)
              setStep('idle')
            }}
            onConfirm={handleConfirm}
          />
        </section>
      ) : (
        <div className="mt-auto pt-[19px]">
          {step === 'forgot' ? (
            <section className="flex flex-col items-center rounded-[20px] border border-line bg-surface px-5 pt-7 pb-6">
              <p className="text-[15px] font-bold">괜찮아요</p>
              <p className="mt-2 text-[12px] text-sub">다른 친구가 기억할지도 몰라요</p>
              <Button onClick={goHome} className="mt-6 w-full">
                방으로 돌아가기
              </Button>
            </section>
          ) : (
            <section className="flex flex-col items-center rounded-[20px] border border-line bg-surface px-5 pt-4 pb-6">
              {/* 멈춤 버튼이 마이크보다 조금 작아서, 자리 크기를 고정해 카드가 흔들리지 않게 한다 */}
              <div className="flex size-16 items-center justify-center">
                <RecordButton
                  recording={step === 'recording'}
                  disabled={step === 'transcribing' || saving}
                  onStart={handleMicClick}
                  onStop={recorder.stop}
                />
              </div>
              <div className="mt-3 flex h-6 items-center">
                {step === 'recording' ? (
                  <WaveProgress elapsedMs={recorder.elapsedMs} maxMs={MAX_VOICE_MS} />
                ) : (
                  <p className={`text-[11px] ${error ? 'text-point' : 'text-sub'}`}>
                    {error ??
                      (step === 'transcribing'
                        ? '받아 적는 중이에요…'
                        : '눌러서 한 문장만 말해 주세요 · 최대 30초')}
                  </p>
                )}
              </div>
              <div className="mt-1.5 flex gap-[11px]">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={saving || step === 'transcribing'}
                  className="h-[37px] w-[110px] rounded-full border border-line/50 text-[11px]"
                >
                  기억 안 나요
                </button>
                <button
                  type="button"
                  onClick={handlePostpone}
                  disabled={saving || step === 'transcribing'}
                  className="h-[37px] w-[110px] rounded-full border border-line/50 text-[11px]"
                >
                  나중에
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  recorder.cancel()
                  setError(null)
                  setStep('text')
                }}
                className="mt-3.5 text-[11px] text-point"
              >
                지금 말하기 어려워요 → 글로 답하기
              </button>
            </section>
          )}
        </div>
      )}
      {voiceLimitOpen && (
        <VoiceLimitSheet
          quota={quota}
          onWriteText={() => {
            setVoiceLimitOpen(false)
            setStep('text')
          }}
          planAction={{
            ...voicePlan.action,
            onClick: () => {
              setVoiceLimitOpen(false)
              voicePlan.action.onClick()
            },
          }}
          onClose={() => setVoiceLimitOpen(false)}
        />
      )}
    </main>
  )
}

export default AskbackPage
