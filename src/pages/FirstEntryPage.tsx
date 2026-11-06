import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { createEntry, skipFirstEntry, transcribe } from '../api/entries'
import { USE_MOCK } from '../api/mock'
import { setPhotoLocation, type Place } from '../api/places'
import AnswerForm, { type VoiceDraft } from '../components/entry/AnswerForm'
import { ChevronLeftIcon, ImagePlaceholderIcon } from '../components/entry/EntryIcons'
import { RecordButton, WaveProgress } from '../components/entry/VoiceControls'
import PlaceSheet from '../components/PlaceSheet'
import { VoiceLimitSheet } from '../components/PlanLimitSheet'
import { formatVoiceLimit, isLimitError, usePlanLimitAction, useRoomHomeForQuota, voiceMaxMs } from '../hooks/useRoomQuota'
import { useVoiceRecorder, type Recording } from '../hooks/useVoiceRecorder'
import { addRecentPlace, getRecentPlaces } from '../lib/roomExtras'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

/** 사진 올리기 화면에서 넘겨받는 값 */
export interface FirstEntryState {
  photos: { photoId: string; file?: File }[]
}

// 첫 한마디 음성은 5초부터 플랜별 최대 30/60/120초, 글은 300자까지 (백엔드 명세)
const MIN_VOICE_MS = 5_000
const MAX_TEXT_LENGTH = 300

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
  // 방 전체 말하기 시간을 다 썼을 때 띄우는 시트
  const [voiceLimitOpen, setVoiceLimitOpen] = useState(false)
  // 사진마다 먼저 장소를 묻는다. 고른 장소 또는 'skipped'(건너뜀). 아직 안 물었으면 없음
  const [places, setPlaces] = useState<Record<number, Place | 'skipped'>>({})
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [confirmSkipPlace, setConfirmSkipPlace] = useState(false)
  const [savingPlace, setSavingPlace] = useState(false)
  const home = useRoomHomeForQuota(roomId, session?.memberAccessToken)
  const quota = home?.room.quota
  const voicePlan = usePlanLimitAction(roomId, home, 'VOICE', setError)
  const maxVoiceMs = voiceMaxMs(quota, 'first')

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
    } catch (e) {
      if (isLimitError(e)) {
        setStep('idle')
        setVoiceLimitOpen(true)
        return
      }
      // 받아 적기에 실패해도 글로 이어서 남길 수 있게 한다
      setError('받아 적지 못했어요. 글로 남겨 주세요')
      setStep('text')
    }
  }

  const recorder = useVoiceRecorder({ maxMs: maxVoiceMs, onFinish: handleRecorded })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (!photo) return <NotFoundPage message="한마디를 남길 사진이 없어요" />

  const placeChoice = places[index]

  const handlePickPlace = async (place: Place) => {
    setPlaceSheetOpen(false)
    setSavingPlace(true)
    setError(null)
    try {
      await setPhotoLocation(photo.photoId, place)
      setPlaces((prev) => ({ ...prev, [index]: place }))
      addRecentPlace(place.city)
    } catch {
      setError('장소를 저장하지 못했어요. 다시 골라 주세요')
    } finally {
      setSavingPlace(false)
    }
  }

  const skipPlace = () => {
    setConfirmSkipPlace(false)
    setPlaces((prev) => ({ ...prev, [index]: 'skipped' }))
  }

  const resetForNextPhoto = () => {
    setConfirmSkipPlace(false)
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
    // 방 전체 말하기 시간을 다 썼으면 녹음하지 않고 안내한다
    if (quota?.voiceRemainingMs === 0) {
      setVoiceLimitOpen(true)
      return
    }
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
    recorder.cancel()
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

      {/* 장소를 고른 뒤에는 사진 아래에 작게 보여주고 다시 바꿀 수 있다 */}
      {placeChoice && (
        <button
          type="button"
          onClick={() => setPlaceSheetOpen(true)}
          className="mt-2.5 flex items-center gap-1.5 self-start rounded-full bg-surface px-3 py-1.5 text-[12px] active:opacity-80"
        >
          {placeChoice === 'skipped' ? (
            <span className="text-sub">📍 장소 없음 · 기록 지도에 표시되지 않아요</span>
          ) : (
            <span>
              📍 <b className="font-semibold">{placeChoice.placeName}</b>
            </span>
          )}
          <span className="font-semibold text-point">{placeChoice === 'skipped' ? '추가 ›' : '바꾸기 ›'}</span>
        </button>
      )}

      {!placeChoice ? (
        // 1단계: 이 사진을 찍은 곳. 건너뛸 수 있지만 그러면 기록 지도에 나오지 않는다고 알려 준다
        <section className="flex flex-1 flex-col items-center justify-center pt-6 text-center">
          <h2 className="text-[17px] font-bold">이 사진, 어디서 찍었어요?</h2>
          <p className="mt-1.5 text-[12px] text-sub">고른 장소는 기록 지도에 꽃으로 피어요</p>
          {error && (
            <p className="mt-3 text-[12px] text-point" role="alert">
              {error}
            </p>
          )}
          {confirmSkipPlace ? (
            <div className="mt-5 w-full rounded-[20px] bg-surface px-4 py-4">
              <p className="text-[14px] font-semibold">장소 없이 넘어갈까요?</p>
              <p className="mt-1 text-[12px] leading-5 text-sub">
                건너뛰면 기록 지도에서 어디를 갔는지 적용되지 않아요
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={skipPlace}
                  className="h-11 rounded-full border border-line bg-surface text-[14px] active:opacity-80"
                >
                  그래도 건너뛰기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSkipPlace(false)
                    setPlaceSheetOpen(true)
                  }}
                  className="h-11 rounded-full bg-ink text-[14px] font-semibold text-surface active:opacity-80"
                >
                  장소 고르기
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={savingPlace}
                onClick={() => setPlaceSheetOpen(true)}
                className="mt-6 h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-surface active:opacity-80 disabled:opacity-50"
              >
                {savingPlace ? '저장하는 중…' : '📍 장소 고르기'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSkipPlace(true)}
                className="mt-3 text-[13px] text-sub underline"
              >
                건너뛰기
              </button>
            </>
          )}
        </section>
      ) : showAnswerCard ? (
        <section className="flex flex-1 flex-col pt-8">
          <h2 className="px-[11px] text-[17px] font-bold">이 사진, 왜 골랐어요?</h2>
          <AnswerForm
            transcript={transcript}
            maxLength={MAX_TEXT_LENGTH}
            voice={step === 'review' ? draft : null}
            error={error}
            saving={saving}
            confirmLabel={isLast ? '확정하고 마치기' : '확정하고 다음 사진'}
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
        <VoiceSection
          step={step}
          elapsedMs={recorder.elapsedMs}
          maxMs={maxVoiceMs}
          error={error}
          onMicClick={handleMicClick}
          onStop={recorder.stop}
          onWrite={() => {
            recorder.cancel()
            setError(null)
            setStep('text')
          }}
        />
      )}
      {placeSheetOpen && (
        <PlaceSheet
          initial={placeChoice && placeChoice !== 'skipped' ? placeChoice.city : undefined}
          recent={getRecentPlaces()}
          onClose={() => setPlaceSheetOpen(false)}
          onSelect={(_, detail) => {
            if (detail) void handlePickPlace(detail)
          }}
        />
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

/** 대기 · 녹음 중 · 받아 적는 중 */
function VoiceSection({
  step,
  elapsedMs,
  maxMs,
  error,
  onMicClick,
  onStop,
  onWrite,
}: {
  step: Step
  elapsedMs: number
  maxMs: number
  error: string | null
  onMicClick: () => void
  onStop: () => void
  onWrite: () => void
}) {
  return (
    <section className="flex flex-1 flex-col items-center pt-4">
      <h2 className="text-[20px] font-bold">이 사진, 왜 골랐어요?</h2>

      {step === 'recording' && (
        <div className="mt-4">
          <WaveProgress elapsedMs={elapsedMs} maxMs={maxMs} />
        </div>
      )}

      <div className={step === 'recording' ? 'mt-3' : 'mt-[42px]'}>
        <RecordButton
          recording={step === 'recording'}
          disabled={step === 'transcribing'}
          onStart={onMicClick}
          onStop={onStop}
        />
      </div>

      <p className={`mt-[30px] text-[11px] ${error ? 'text-point' : 'text-sub'}`}>
        {error ??
          (step === 'recording'
            ? '다시 누르면 녹음이 멈춰요'
            : step === 'transcribing'
              ? '받아 적는 중이에요…'
              : `눌러서 한두 문장만 말해 주세요 · 최대 ${formatVoiceLimit(maxMs)}`)}
      </p>
      <button type="button" onClick={onWrite} className="mt-5 text-[11px] text-point">
        지금 말하기 어려워요 → 글로 답하기
      </button>
    </section>
  )
}

export default FirstEntryPage
