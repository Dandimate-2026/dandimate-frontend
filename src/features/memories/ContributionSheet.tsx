import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import { RecordButton, WaveProgress } from '../../components/entry/VoiceControls'
import { formatDuration, useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { BottomSheet, MemoryHeader } from './components'
import type { MemoryContribution } from './types'
import { formatVoiceLimit } from '../../hooks/useRoomQuota'
import { LengthNotice } from '../../components/LengthNotice'
import { clampText } from '../../lib/textLimit'
import { useAudioPlayback } from '../../hooks/useAudioPlayback'
import { PlayIcon, RetryIcon, StopIcon } from '../../components/entry/EntryIcons'
import { readDraft, writeDraft } from '../../lib/entryDraft'

export default function ContributionSheet({ kind, quote, initial, startWithText = false, fullPage = false, onSave, onClose, onTranscribe, maxLength = 500, maxVoiceMs, draftKey }: {
  kind: 'addition' | 'reply'
  quote: string
  initial?: MemoryContribution
  startWithText?: boolean
  fullPage?: boolean
  onSave: (value: MemoryContribution) => void | Promise<void>
  onClose: () => void
  onTranscribe?: (audio: Blob) => Promise<{ transcript: string; transcriptionId: string }>
  maxLength?: number
  /** 녹음 최대 길이(ms). 플랜별 20/30/60초 */
  maxVoiceMs?: number
  /** 쓰다 만 글을 이 기기에 남겨 둘 이름 (사진·문단마다). 없으면 남기지 않는다 */
  draftKey?: string
}) {
  // 저장하지 않고 나갔던 글이 있으면 불러와서 글쓰기 칸으로 바로 연다
  const [restored] = useState(() => (initial ? '' : readDraft(draftKey)))
  const [mode, setMode] = useState<'voice' | 'text'>(startWithText || initial || restored ? 'text' : 'voice')
  const [text, setText] = useState(initial?.text ?? restored)
  const [audio, setAudio] = useState<{ url: string; blob?: Blob; durationMs: number } | null>(initial?.audioUrl ? { url: initial.audioUrl, durationMs: initial.durationMs ?? 0 } : null)
  const [transcriptionId, setTranscriptionId] = useState(initial?.transcriptionId)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const ownedUrls = useRef<string[]>([])
  const savedUrl = useRef<string | undefined>(undefined)
  const mounted = useRef(false)
  // 서버가 알려 준 길이가 없으면 가장 짧은 Free 기준(20초)으로 막는다
  const maxMs = maxVoiceMs ?? 20000
  const recorder = useVoiceRecorder({ maxMs, onFinish: (recording) => {
    if (!mounted.current) return
    const url = URL.createObjectURL(recording.blob)
    ownedUrls.current.push(url)
    setAudio({ url, blob: recording.blob, durationMs: recording.durationMs })
    setTranscriptionId(undefined)
    if (onTranscribe) {
      setTranscribing(true)
      void onTranscribe(recording.blob).then((draft) => {
        if (!mounted.current) return
        setText(draft.transcript)
        setTranscriptionId(draft.transcriptionId)
        setMode('text')
      }).catch((cause: unknown) => {
        if (mounted.current) setError(cause instanceof Error ? cause.message : '받아쓰기에 실패했어요. 다시 녹음하거나 글로 남겨 주세요.')
      }).finally(() => { if (mounted.current) setTranscribing(false) })
    }
  } })

  // 녹음 듣기: 처음 한마디 화면과 같이 [정지 / 이어 듣기 / 다시 듣기] 한 버튼으로
  const playback = useAudioPlayback(audio?.url)

  // 쓰는 대로 이 기기에 남겨 둔다 (저장하면 지운다)
  useEffect(() => { writeDraft(draftKey, text) }, [draftKey, text])

  useEffect(() => {
    mounted.current = true
    const urls = ownedUrls.current
    return () => {
      mounted.current = false
      urls.filter((url) => url !== savedUrl.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  async function start() {
    if (starting || recorder.recording) return
    playback.reset()
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('녹음을 지원하지 않는 환경이에요. 글로 남겨 주세요.')
      setMode('text')
      return
    }
    setStarting(true)
    try {
      await recorder.start()
      if (!mounted.current) { recorder.cancel(); return }
      setAudio(null)
    } catch {
      if (mounted.current) setError('마이크를 사용할 수 없어요. 권한을 확인하거나 글로 남겨 주세요.')
    } finally { if (mounted.current) setStarting(false) }
  }

  async function save() {
    if ((!text.trim() && !audio) || recorder.recording || starting || transcribing || saving) return
    if (onTranscribe && !text.trim()) { setError('받아쓴 글을 확인해 주세요.'); return }
    savedUrl.current = audio?.url
    setSaving(true)
    setError('')
    try {
      await onSave({ text: text.trim(), audioUrl: audio?.url, audioBlob: audio?.blob, transcriptionId, durationMs: audio?.durationMs })
      writeDraft(draftKey, '')
    } catch (cause) {
      savedUrl.current = undefined
      setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.')
    } finally { if (mounted.current) setSaving(false) }
  }

  const voiceButtons = <div className="memory-voice-actions">
    <Button variant="outline" onClick={playback.toggle} aria-pressed={playback.playing}>
      {playback.playing ? <StopIcon /> : <PlayIcon />}{playback.playing ? '정지' : playback.paused ? '이어 듣기' : '다시 듣기'}
    </Button>
    <Button variant="outline" disabled={starting || transcribing || saving} onClick={() => { setMode('voice'); void start() }}>
      <RetryIcon />다시 녹음
    </Button>
  </div>

  const content = <>
    <blockquote>{quote}</blockquote>
    <h3>{fullPage ? '어떻게 다시 엮어 볼까요?' : kind === 'reply' ? '여기에 빠진 이야기가 있나요?' : '이 장면, 당신은 어떻게 기억해요?'}</h3>
    <p className="memory-sheet-hint">{kind === 'reply' ? '당신이 기억하는 장면을 보태주세요' : '한 두 문장이면 충분해요'}</p>
    {mode === 'voice' ? <div className="memory-recorder">
      {audio ? <><p>녹음 {formatDuration(audio.durationMs)}</p>{voiceButtons}</> : <>
        <RecordButton recording={recorder.recording} disabled={starting} onStart={() => void start()} onStop={recorder.stop} />
        {recorder.recording ? <WaveProgress elapsedMs={recorder.elapsedMs} maxMs={maxMs} /> : <p>{starting ? '마이크 연결 중…' : `눌러서 ${kind === 'reply' ? '한두 문장만 ' : ''}말해 주세요 · 최대 ${formatVoiceLimit(maxMs)}`}</p>}
      </>}
    </div> : <div className="memory-write-field">
      {restored && text === restored && <p className="memory-sheet-hint" role="status">저장하지 않고 나갔던 이야기를 불러왔어요. 다 쓰면 남겨 주세요</p>}
      <label htmlFor="memory-contribution">{audio ? `받아 적은 글 · 눌러서 고칠 수 있어요 · 녹음 ${formatDuration(audio.durationMs)}` : '내 이야기'}</label>
      <textarea id="memory-contribution" value={text} onChange={(event) => setText(clampText(event.target.value, maxLength))} maxLength={maxLength} rows={4} placeholder="내가 기억하는 장면을 적어 주세요" autoFocus />
      <span>{text.length}/{maxLength}</span>
      <LengthNotice length={text.length} max={maxLength} />
      {audio && voiceButtons}
    </div>}
    {error && <p role="alert" className="memory-error">{error}</p>}
    {transcribing && <p role="status" className="memory-sheet-hint">녹음을 글로 옮기고 있어요…</p>}
    {(mode === 'text' || audio) && <Button className="memory-save" onClick={() => void save()} disabled={(!text.trim() && !audio) || recorder.recording || starting || transcribing || saving}>{saving ? '저장 중…' : fullPage ? '이 이야기로 다시 엮기' : kind === 'reply' ? '다시 엮기' : '기억 남기기'}</Button>}
    {!(mode === 'text' && audio) && <button type="button" className="memory-text-link memory-mode-link" disabled={starting || transcribing || saving} onClick={() => { recorder.cancel(); setMode(mode === 'voice' ? 'text' : 'voice') }}>{mode === 'voice' ? '지금 말하기 어려워요 → 글로 답하기' : '말로 답하기'}</button>}
  </>
  if (fullPage) return <main className="memory-page memory-reweave-editor"><MemoryHeader title="다시 엮기" onBack={() => { if (!saving) onClose() }} /><div className="memory-reweave-content">{content}</div></main>
  return <BottomSheet title={kind === 'reply' ? '다시 엮기' : '덧붙이기'} onClose={() => { if (!saving) onClose() }}>{content}</BottomSheet>
}
