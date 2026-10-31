import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { createEntry, skipFirstEntry, transcribe } from '../api/entries'
import { USE_MOCK } from '../api/mock'
import Button from '../components/Button'
import {
  ChevronLeftIcon,
  ImagePlaceholderIcon,
  MicIcon,
  PencilIcon,
  PlayIcon,
  RetryIcon,
} from '../components/entry/EntryIcons'
import { formatDuration, useVoiceRecorder, type Recording } from '../hooks/useVoiceRecorder'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

/** 사진 올리기 화면에서 넘겨받는 값 */
export interface FirstEntryState {
  photos: { photoId: string; file?: File }[]
}

// 첫 한마디 음성은 5~60초, 글은 300자까지 (백엔드 명세)
const MIN_VOICE_MS = 5_000
const MAX_VOICE_MS = 60_000
const MAX_TEXT_LENGTH = 300

// 녹음 중 파형 막대 높이 (시안 그대로)
const WAVE_BARS = [6, 10, 8, 14, 20, 14, 8, 16, 24, 16, 10, 6, 10, 8, 6]

// mock 모드에서 사진 올리기를 거치지 않고 바로 들어왔을 때 보여줄 사진
const MOCK_PHOTOS: FirstEntryState['photos'] = [{ photoId: 'mock-1' }, { photoId: 'mock-2' }, { photoId: 'mock-3' }]

/**
 * 화면 상태
 * - idle: 마이크 버튼 대기
 * - recording: 녹음 중
 * - transcribing: 녹음을 글로 받아 적는 중
 * - review: 받아 적은 글 확인·수정
 * - text: 말하기 대신 글로 직접 쓰기
 */
type Step = 'idle' | 'recording' | 'transcribing' | 'review' | 'text'

interface VoiceDraft {
  transcriptionId: string
  durationMs: number
  audioUrl: string
}

/** 고른 사진마다 "이 사진, 왜 골랐어요?"에 음성(또는 글)으로 답하는 화면 */
function FirstEntryPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getRoomSession(roomId)
  const photos = (location.state as FirstEntryState | null)?.photos ?? (USE_MOCK ? MOCK_PHOTOS : [])

  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('idle')
  const [transcript, setTranscript] = useState('')
  const [draft, setDraft] = useState<VoiceDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const photo = photos[index]
  const isLast = index === photos.length - 1
  const previewUrl = useMemo(() => (photo?.file ? URL.createObjectURL(photo.file) : null), [photo])
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl])
  useEffect(() => () => void (draft && URL.revokeObjectURL(draft.audioUrl)), [draft])

  const handleRecorded = async ({ blob, durationMs }: Recording) => {
    if (durationMs < MIN_VOICE_MS) {
      setError('5초 이상 말해 주세요')
      setStep('idle')
      return
    }
    setStep('transcribing')
    try {
      const result = await transcribe(photo.photoId, session?.memberAccessToken ?? '', blob)
      setDraft({ transcriptionId: result.transcriptionId, durationMs, audioUrl: URL.createObjectURL(blob) })
      setTranscript(result.transcript)
      setStep('review')
    } catch {
      // 받아 적기에 실패해도 글로 이어서 남길 수 있게 한다
      setError('받아 적지 못했어요. 글로 남겨 주세요')
      setStep('text')
    }
  }

  const recorder = useVoiceRecorder({ maxMs: MAX_VOICE_MS, onFinish: handleRecorded })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (!photo) return <NotFoundPage message="한마디를 남길 사진이 없어요" />

  const resetForNextPhoto = () => {
    setStep('idle')
    setTranscript('')
    setDraft(null)
    setError(null)
  }

  const goNext = () => {
    if (isLast) {
      navigate(paths.roomHome(roomId), { replace: true })
      return
    }
    setIndex((i) => i + 1)
    resetForNextPhoto()
  }

  const handleMicClick = async () => {
    setError(null)
    try {
      await recorder.start()
      setStep('recording')
    } catch {
      setError('마이크를 쓸 수 없어요. 글로 남겨 주세요')
      setStep('text')
    }
  }

  const handleConfirm = async () => {
    const text = transcript.trim()
    if (!text || saving) return
    setSaving(true)
    setError(null)
    try {
      await createEntry(
        photo.photoId,
        session.memberAccessToken,
        step === 'review' && draft
          ? { kind: 'FIRST', inputMode: 'VOICE', transcriptionId: draft.transcriptionId, transcript: text }
          : { kind: 'FIRST', inputMode: 'TEXT', transcript: text },
      )
      goNext()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (recorder.recording) recorder.stop()
    try {
      await skipFirstEntry(photo.photoId, session.memberAccessToken)
    } catch {
      // 건너뛰기가 실패해도 다음 사진으로는 넘어간다
    }
    goNext()
  }

  const showAnswerCard = step === 'review' || step === 'text'

  return (
    // 화면 높이에 맞춰 사진 영역이 늘었다 줄었다 해서, 아래 버튼이 항상 한 화면에 보이게 한다
    <main className="flex h-dvh min-h-[600px] flex-col bg-bg px-5 pt-12 pb-8 text-ink">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-[18px]">
          {/* TODO: 뒤로 가기 목적지 확정 필요 (지금은 브라우저 히스토리 기준) */}
          <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-[17px] font-bold">
            <ChevronLeftIcon />첫 한마디
          </button>
          <span className="text-[11px] text-sub">
            {index + 1} / {photos.length}
          </span>
        </div>
        <button type="button" onClick={handleSkip} disabled={saving} className="text-[11px] text-sub">
          나중에
        </button>
      </header>

      {/* 내가 고른 사진. 시안 높이(337px, 확인 단계 220px)를 기본으로 하고 화면이 낮으면 줄어든다 */}
      <div
        className={`mt-[clamp(20px,9dvh,96px)] flex min-h-[120px] shrink grow-0 items-center justify-center overflow-hidden rounded-xl bg-[#efe9df] ${
          showAnswerCard ? 'basis-[220px]' : 'basis-[337px]'
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="내가 고른 사진" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-[11px] text-sub">
            <ImagePlaceholderIcon />
            내가 고른 사진
          </div>
        )}
      </div>

      {showAnswerCard ? (
        <AnswerSection
          step={step}
          transcript={transcript}
          draft={draft}
          error={error}
          saving={saving}
          isLast={isLast}
          onChange={setTranscript}
          onRetry={() => {
            setDraft(null)
            setTranscript('')
            setError(null)
            setStep('idle')
          }}
          onConfirm={handleConfirm}
        />
      ) : (
        <VoiceSection
          step={step}
          elapsedMs={recorder.elapsedMs}
          error={error}
          onMicClick={handleMicClick}
          onStop={recorder.stop}
          onWrite={() => {
            if (recorder.recording) recorder.stop()
            setError(null)
            setStep('text')
          }}
        />
      )}
    </main>
  )
}

/** 대기 · 녹음 중 · 받아 적는 중 */
function VoiceSection({
  step,
  elapsedMs,
  error,
  onMicClick,
  onStop,
  onWrite,
}: {
  step: Step
  elapsedMs: number
  error: string | null
  onMicClick: () => void
  onStop: () => void
  onWrite: () => void
}) {
  const filledBars = Math.ceil((elapsedMs / MAX_VOICE_MS) * WAVE_BARS.length)

  return (
    <section className="flex flex-1 flex-col items-center pt-4">
      <h2 className="text-[20px] font-bold">이 사진, 왜 골랐어요?</h2>

      {step === 'recording' && (
        <div className="mt-4 flex h-6 items-center gap-3">
          <div className="flex items-center gap-[3px]" aria-hidden="true">
            {WAVE_BARS.map((h, i) => (
              <span
                key={i}
                className={`w-[3px] rounded-full ${i < filledBars ? 'bg-point' : 'bg-line'}`}
                style={{ height: h }}
              />
            ))}
          </div>
          <span className="text-[11px] text-point">
            {formatDuration(elapsedMs)} / {formatDuration(MAX_VOICE_MS)}
          </span>
        </div>
      )}

      <div className={step === 'recording' ? 'mt-3' : 'mt-[42px]'}>
        {step === 'recording' ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="녹음 멈추기"
            className="flex size-[61px] items-center justify-center rounded-full border-[3px] border-[#f6e3ea] bg-point"
          >
            <span className="size-[18px] rounded bg-surface" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMicClick}
            disabled={step === 'transcribing'}
            aria-label="녹음 시작"
            className="flex size-16 items-center justify-center rounded-full bg-ink text-surface disabled:opacity-60"
          >
            <MicIcon />
          </button>
        )}
      </div>

      <p className={`mt-[30px] text-[11px] ${error ? 'text-point' : 'text-sub'}`}>
        {error ??
          (step === 'recording'
            ? '다시 누르면 녹음이 멈춰요'
            : step === 'transcribing'
              ? '받아 적는 중이에요…'
              : '눌러서 한두 문장만 말해 주세요 · 최대 1분')}
      </p>
      <button type="button" onClick={onWrite} className="mt-5 text-[11px] text-point">
        지금 말하기 어려워요 → 글로 답하기
      </button>
    </section>
  )
}

/** 받아 적은 글 확인 · 글로 직접 쓰기 */
function AnswerSection({
  step,
  transcript,
  draft,
  error,
  saving,
  isLast,
  onChange,
  onRetry,
  onConfirm,
}: {
  step: Step
  transcript: string
  draft: VoiceDraft | null
  error: string | null
  saving: boolean
  isLast: boolean
  onChange: (text: string) => void
  onRetry: () => void
  onConfirm: () => void
}) {
  const isVoice = step === 'review' && draft !== null

  return (
    <section className="flex flex-1 flex-col pt-8">
      <h2 className="px-[11px] text-[17px] font-bold">이 사진, 왜 골랐어요?</h2>

      <div className="mt-3.5 rounded-[20px] border border-line bg-surface px-[19px] pt-3.5 pb-4">
        <div className="flex items-center justify-between text-[11px] text-sub">
          <label htmlFor="entry-text">{isVoice ? '받아 적은 글 · 눌러서 고칠 수 있어요' : '글로 남기기'}</label>
          {isVoice ? (
            <span className="flex items-center gap-1">
              <PencilIcon />
              녹음 {formatDuration(draft.durationMs)}
            </span>
          ) : (
            <span>
              {transcript.length}/{MAX_TEXT_LENGTH}
            </span>
          )}
        </div>
        <textarea
          id="entry-text"
          value={transcript}
          maxLength={MAX_TEXT_LENGTH}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          placeholder="한두 문장이면 충분해요"
          className="mt-2 w-full resize-none bg-transparent text-[13px] leading-[19px] outline-none placeholder:text-muted"
        />
      </div>
      {error && <p className="mt-2 px-1 text-[11px] text-point">{error}</p>}

      <div className="mt-auto pt-8">
        <div className={`grid gap-4 ${isVoice ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {isVoice && (
            <Button
              variant="outline"
              onClick={() => void new Audio(draft.audioUrl).play()}
              className="flex h-[51px] items-center justify-center gap-2 rounded-full"
            >
              <PlayIcon />
              다시 듣기
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onRetry}
            className="flex h-[51px] items-center justify-center gap-2 rounded-full"
          >
            <RetryIcon />
            {isVoice ? '다시 녹음' : '말로 하기'}
          </Button>
        </div>
        <Button onClick={onConfirm} disabled={!transcript.trim() || saving} className="mt-3 w-full">
          {saving ? '저장하는 중…' : isLast ? '확정하고 마치기' : '확정하고 다음 사진'}
        </Button>
      </div>
    </section>
  )
}

export default FirstEntryPage
