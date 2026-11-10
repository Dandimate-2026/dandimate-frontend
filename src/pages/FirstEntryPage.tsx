import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { createEntry, transcribe } from '../api/entries'
import { deletePhoto, uploadPhotos } from '../api/photos'
import { setPhotoLocation, type Place } from '../api/places'
import { readPhotoDraft, removePhotoDraft, saveRecordingDraft } from '../lib/photoDraft'
import { readDraft, writeDraft } from '../lib/entryDraft'
import AnswerForm from '../components/entry/AnswerForm'
import { ChevronLeftIcon, ImagePlaceholderIcon, PlayIcon, RetryIcon, StopIcon } from '../components/entry/EntryIcons'
import Button from '../components/Button'
import { useAudioPlayback } from '../hooks/useAudioPlayback'
import { RecordButton, WaveProgress } from '../components/entry/VoiceControls'
import PlaceSheet from '../components/PlaceSheet'
import { VoiceLimitSheet } from '../components/PlanLimitSheet'
import { formatVoiceLimit, isLimitError, usePlanLimitAction, useRoomHomeForQuota, voiceMaxMs } from '../hooks/useRoomQuota'
import { formatDuration, useVoiceRecorder, type Recording } from '../hooks/useVoiceRecorder'
import { addRecentPlace, getRecentPlaces } from '../lib/roomExtras'
import { getRoomSession } from '../lib/session'
import { prepareImage } from '../lib/image'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'

/** 사진 올리기 화면에서 넘겨받는 값 */
export interface FirstEntryState {
  photos: { photoId: string; file?: File; pending?: boolean }[]
}

// 첫 한마디 음성은 5초부터 플랜별 최대 30/60/120초, 글은 300자까지 (백엔드 명세)
const MIN_VOICE_MS = 5_000
const MAX_TEXT_LENGTH = 300

// mock 모드에서 사진 올리기를 거치지 않고 바로 들어왔을 때 보여줄 사진

type Step = 'idle' | 'recording' | 'recorded' | 'text'

/** 고른 사진마다 "이 사진, 왜 골랐어요?"에 음성(또는 글)으로 답하는 화면 */
function FirstEntryPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getRoomSession(roomId)
  const [photos, setPhotos] = useState<FirstEntryState['photos']>(() => (location.state as FirstEntryState | null)?.photos ?? ([]))
  const [restoring, setRestoring] = useState(!photos.length)
  useEffect(() => { if (photos.length) return; let active = true; readPhotoDraft(roomId).then(items => { if (active) { setPhotos(items.map(item => ({ photoId: item.id, file: item.file, pending: true }))); setRestoring(false) } }); return () => { active = false } }, [roomId, photos.length])

  const uploaded = useRef(new Map<string, string>())
  const committed = useRef(new Set<string>())
  const alive = useRef(true)
  const writeLock = useRef(false)
  useEffect(() => {
    alive.current = true
    const pending = uploaded.current
    const saved = committed.current
    return () => {
      alive.current = false
      for (const id of pending.values()) if (!saved.has(id)) void deletePhoto(id).catch(() => {})
    }
  }, [])

  async function ensureUploaded(item: FirstEntryState['photos'][number]) {
    if (!item.pending || !item.file) return item.photoId
    const existing = uploaded.current.get(item.photoId)
    if (existing) return existing
    const { blob, contentType } = await prepareImage(item.file)
    if (!alive.current) throw new Error('사진 작성을 취소했어요')
    const [id] = await uploadPhotos(roomId, session?.memberAccessToken ?? '', [{ blob, request: {
      clientFileId: item.photoId, fileName: item.file.name, contentType, sizeBytes: blob.size, displayOrder: photos.findIndex(p => p.photoId === item.photoId) + 1,
    } }], () => !alive.current)
    uploaded.current.set(item.photoId, id)
    if (!alive.current) {
      await deletePhoto(id)
      throw new Error('사진 작성을 취소했어요')
    }
    return id
  }

  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('idle')
  const [transcript, setTranscript] = useState('')
  const [localRecording, setLocalRecording] = useState<(Recording & { audioUrl: string }) | null>(null)
  useEffect(() => () => { if (localRecording) URL.revokeObjectURL(localRecording.audioUrl) }, [localRecording])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const playback = useAudioPlayback(step === 'recorded' && !saving ? localRecording?.audioUrl : null)
  // 방 전체 말하기 시간을 다 썼을 때 띄우는 시트
  const [voiceLimitOpen, setVoiceLimitOpen] = useState(false)
  // 사진마다 먼저 장소를 묻는다. 고른 장소 또는 'skipped'(건너뜀). 아직 안 물었으면 없음
  const [places, setPlaces] = useState<Record<number, Place | 'skipped'>>({})
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)
  const [confirmSkipPlace, setConfirmSkipPlace] = useState(false)
  // 한마디를 확정했거나 '나중에'로 넘긴 사진 (뒤로 가면 나머지 사진은 올리지 않은 것으로 지운다)
  const [finished, setFinished] = useState<Set<number>>(() => new Set())
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const home = useRoomHomeForQuota(roomId, session?.memberAccessToken)
  const quota = home?.room.quota
  const voicePlan = usePlanLimitAction(roomId, home, 'VOICE', setError)
  const maxVoiceMs = voiceMaxMs(quota, 'first')

  const photo = photos[index]
  const isLast = index === photos.length - 1
  const draftKey = photo ? `first:${roomId}:${photo.photoId}` : undefined
  useEffect(() => {
    let active = true
    if (photo) void readPhotoDraft(roomId).then(items => {
      if (!active) return
      const text = readDraft(draftKey)
      const voice = items.find(item => item.id === photo.photoId)?.recording
      setTranscript(text)
      if (text) setStep('text')
      else if (voice) { setLocalRecording({ ...voice, audioUrl: URL.createObjectURL(voice.blob) }); setStep('recorded') }
      try { const saved = sessionStorage.getItem(`duruduru:first-place:${roomId}:${photo.photoId}`); if (saved) setPlaces(prev => ({ ...prev, [index]: JSON.parse(saved) })) } catch { /* optional */ }
    })
    return () => { active = false }
  }, [draftKey, roomId, photo, index])
  const previewUrl = useMemo(() => (photo?.file ? URL.createObjectURL(photo.file) : null), [photo])
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl])

  const handleRecorded = async ({ blob, durationMs }: Recording) => {
    if (durationMs < MIN_VOICE_MS) {
      setError('5초 이상 말해 주세요')
      setStep('idle')
      return
    }
    void saveRecordingDraft(roomId, photo.photoId, { blob, durationMs })
    setLocalRecording({ blob, durationMs, audioUrl: URL.createObjectURL(blob) })
    setStep('recorded')
  }

  const recorder = useVoiceRecorder({ maxMs: maxVoiceMs, onFinish: handleRecorded })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />
  if (restoring) return <main className="p-5 pt-16" role="status">작성 중인 사진을 불러오고 있어요…</main>
  if (!photo) return <NotFoundPage message="한마디를 남길 사진이 없어요" />

  const placeChoice = places[index]

  const handlePickPlace = (place: Place) => {
    setPlaceSheetOpen(false)
    setPlaces((prev) => ({ ...prev, [index]: place }))
    try { sessionStorage.setItem(`duruduru:first-place:${roomId}:${photo.photoId}`, JSON.stringify(place)) } catch { /* optional */ }
    addRecentPlace(place.city)
  }

  const skipPlace = () => {
    setConfirmSkipPlace(false)
    setPlaces((prev) => ({ ...prev, [index]: 'skipped' }))
    try { sessionStorage.setItem(`duruduru:first-place:${roomId}:${photo.photoId}`, JSON.stringify('skipped')) } catch { /* optional */ }
  }

  const resetForNextPhoto = () => {
    setConfirmSkipPlace(false)
    setStep('idle')
    setTranscript('')
    setLocalRecording(null)
    setError(null)
  }

  const goNext = () => {
    writeDraft(draftKey, '')
    void removePhotoDraft(roomId, photo.photoId)
    try { sessionStorage.removeItem(`duruduru:first-place:${roomId}:${photo.photoId}`) } catch { /* optional */ }
    setFinished((prev) => new Set(prev).add(index))
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
    if (!text || saving || writeLock.current) return
    writeLock.current = true
    setSaving(true)
    setError(null)
    try {
      const photoId = await ensureUploaded(photo)
      const selected = places[index]
      if (selected && selected !== 'skipped') await setPhotoLocation(photoId, selected)
      if (!alive.current) return
      await createEntry(
        photoId,
        session.memberAccessToken,
        { kind: 'FIRST', inputMode: 'TEXT', transcript: text },
      )
      committed.current.add(uploaded.current.get(photo.photoId) ?? photo.photoId)
      goNext()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      writeLock.current = false
      setSaving(false)
    }
  }

  const handleVoiceConfirm = async () => {
    if (!localRecording || writeLock.current) return
    writeLock.current = true
    setSaving(true)
    setError(null)
    try {
      const photoId = await ensureUploaded(photo)
      const selected = places[index]
      if (selected && selected !== 'skipped') await setPhotoLocation(photoId, selected)
      if (!alive.current) return
      const result = await transcribe(photoId, session.memberAccessToken, localRecording.blob)
      if (!alive.current) return
      await createEntry(photoId, session.memberAccessToken, { kind: 'FIRST', inputMode: 'VOICE', transcriptionId: result.transcriptionId, transcript: result.transcript })
      committed.current.add(photoId)
      goNext()
    } catch (cause) {
      if (isLimitError(cause)) setVoiceLimitOpen(true)
      else setError(cause instanceof Error ? cause.message : '사진과 녹음을 저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      writeLock.current = false
      setSaving(false)
    }
  }

  const showAnswerCard = step === 'text'
  const unfinishedCount = photos.length - finished.size

  // 확정 도중 실패해 서버에 임시로 남은 사진도 이탈 시 정리한다.
  const leaveAndDelete = async () => {
    setLeaving(true)
    recorder.cancel()
    await Promise.allSettled(photos.filter((_, i) => !finished.has(i)).flatMap((p) => { const id = uploaded.current.get(p.photoId) ?? (!p.pending ? p.photoId : null); return id ? [deletePhoto(id)] : [] }))
    navigate(-1)
  }

  return (
    // 화면 높이에 맞춰 사진 영역이 늘었다 줄었다 해서, 아래 버튼이 항상 한 화면에 보이게 한다
    <main className="flex min-h-dvh flex-col bg-bg px-5 pt-12 pb-[max(32px,env(safe-area-inset-bottom))] text-ink">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-[18px]">
          {/* TODO: 뒤로 가기 목적지 확정 필요 (지금은 브라우저 히스토리 기준) */}
          <button
            type="button"
            disabled={saving}
            onClick={() => (unfinishedCount > 0 ? setConfirmLeave(true) : navigate(-1))}
            className="flex items-center gap-2 text-[17px] font-bold"
          >
            <ChevronLeftIcon />첫 한마디
          </button>
          <span className="text-[11px] text-sub">
            {index + 1} / {photos.length}
          </span>
        </div>

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
                onClick={() => setPlaceSheetOpen(true)}
                className="mt-6 h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-surface active:opacity-80 disabled:opacity-50"
              >
                📍 장소 고르기
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
      ) : step === 'recorded' && localRecording ? (
        <section className="flex flex-1 flex-col pt-6">
          <h2 className="text-[17px] font-bold">녹음을 확인하고 올려 주세요</h2>
          <p className="mt-3 text-[12px] text-sub">녹음 {formatDuration(localRecording.durationMs)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={saving} onClick={playback.toggle} aria-pressed={playback.playing} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full px-3 text-[13px]">
              {playback.playing ? <StopIcon /> : <PlayIcon />}{playback.playing ? '정지' : playback.paused ? '이어 듣기' : '다시 듣기'}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => { playback.reset(); void saveRecordingDraft(roomId, photo.photoId); setLocalRecording(null); setStep('idle') }} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full px-3 text-[13px]"><RetryIcon />다시 녹음</Button>
          </div>
          {playback.error && <p role="alert" className="mt-2 text-[12px] text-point">녹음을 재생하지 못했어요. 다시 듣기를 눌러 주세요.</p>}
          <p className="mt-3 text-[12px] leading-5 text-sub">확정하면 사진과 녹음을 올리고, 받아 적은 글을 첫 한마디로 저장해요.</p>
          {error && <p role="alert" className="mt-3 text-[12px] text-point">{error}</p>}
          <button type="button" disabled={saving} onClick={() => { void saveRecordingDraft(roomId, photo.photoId); setLocalRecording(null); setStep('text') }} className="min-h-11 text-[13px] text-point">글로 남기기</button>
          <button type="button" disabled={saving} onClick={() => void handleVoiceConfirm()} className="mt-auto min-h-[52px] rounded-full bg-ink px-4 text-[15px] font-semibold text-surface disabled:opacity-50">{saving ? '사진과 녹음 저장 중…' : '확정하고 사진 올리기'}</button>
        </section>
      ) : showAnswerCard ? (
        <section className="flex flex-1 flex-col pt-8">
          <h2 className="px-[11px] text-[17px] font-bold">이 사진, 왜 골랐어요?</h2>
          <AnswerForm
            transcript={transcript}
            maxLength={MAX_TEXT_LENGTH}
            voice={null}
            error={error}
            saving={saving}
            confirmLabel={isLast ? '확정하고 마치기' : '확정하고 다음 사진'}
            onChange={text => { setTranscript(text); writeDraft(draftKey, text) }}
            onRetry={() => {
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
      {confirmLeave && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-8" onClick={() => setConfirmLeave(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-[24px] bg-surface px-5 pt-6 pb-5 text-center"
          >
            <h2 id="leave-title" className="text-[16px] font-bold">
              작성을 잠시 멈출까요?
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-sub">
              아직 확정하지 않은 사진 {unfinishedCount}장은
              <br />
              아직 공개되지 않았어요. 사진과 글은 임시 저장돼요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="h-12 rounded-full border border-line bg-surface text-[15px] font-semibold active:opacity-80"
              >
                계속 남기기
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => void leaveAndDelete()}
                className="h-12 rounded-full bg-ink text-[15px] font-semibold text-surface active:opacity-80 disabled:opacity-50"
              >
                {leaving ? '나가는 중…' : '임시 저장하고 나가기'}
              </button>
            </div>
          </div>
        </div>
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
          onStart={onMicClick}
          onStop={onStop}
        />
      </div>

      <p className={`mt-[30px] text-[11px] ${error ? 'text-point' : 'text-sub'}`}>
        {error ??
          (step === 'recording'
            ? '다시 누르면 녹음이 멈춰요'
            : `눌러서 한두 문장만 말해 주세요 · 최대 ${formatVoiceLimit(maxMs)}`)}
      </p>
      <button type="button" onClick={onWrite} className="mt-5 text-[11px] text-point">
        지금 말하기 어려워요 → 글로 답하기
      </button>
    </section>
  )
}

export default FirstEntryPage
