import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import { RecordButton, WaveProgress } from '../../components/entry/VoiceControls'
import { formatDuration, useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { BottomSheet } from './components'
import type { MemoryContribution } from './types'

export default function ContributionSheet({ kind, quote, initial, startWithText = false, onSave, onClose, onTranscribe, maxLength = 500 }: {
  kind: 'addition' | 'reply'
  quote: string
  initial?: MemoryContribution
  startWithText?: boolean
  onSave: (value: MemoryContribution) => void | Promise<void>
  onClose: () => void
  onTranscribe?: (audio: Blob) => Promise<{ transcript: string; transcriptionId: string }>
  maxLength?: number
}) {
  const [mode, setMode] = useState<'voice' | 'text'>(startWithText || initial ? 'text' : 'voice')
  const [text, setText] = useState(initial?.text ?? '')
  const [audio, setAudio] = useState<{ url: string; blob?: Blob; durationMs: number } | null>(initial?.audioUrl ? { url: initial.audioUrl, durationMs: initial.durationMs ?? 0 } : null)
  const [transcriptionId, setTranscriptionId] = useState(initial?.transcriptionId)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const ownedUrls = useRef<string[]>([])
  const savedUrl = useRef<string | undefined>(undefined)
  const mounted = useRef(false)
  const maxMs = kind === 'reply' ? 60000 : 30000
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
    } catch (cause) {
      savedUrl.current = undefined
      setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.')
    } finally { if (mounted.current) setSaving(false) }
  }

  return <BottomSheet title={kind === 'reply' ? '답가 쓰기' : '덧붙이기'} onClose={onClose}>
    <blockquote>{quote}</blockquote>
    <h3>{kind === 'reply' ? '여기에 빠진 이야기가 있나요?' : '이 장면, 당신은 어떻게 기억해요?'}</h3>
    <p className="memory-sheet-hint">{kind === 'reply' ? '당신이 기억하는 장면을 보태주세요' : '한 두 문장이면 충분해요'}</p>
    {mode === 'voice' ? <div className="memory-recorder">
      {audio ? <><audio controls src={audio.url} aria-label="녹음 미리 듣기" /><p>녹음 {formatDuration(audio.durationMs)}</p><button type="button" className="memory-text-link" onClick={() => void start()}>다시 녹음하기</button></> : <>
        <RecordButton recording={recorder.recording} disabled={starting} onStart={() => void start()} onStop={recorder.stop} />
        {recorder.recording ? <WaveProgress elapsedMs={recorder.elapsedMs} maxMs={maxMs} /> : <p>{starting ? '마이크 연결 중…' : `눌러서 ${kind === 'reply' ? '한두 문장만 ' : ''}말해 주세요 · 최대 ${kind === 'reply' ? '1분' : '30초'}`}</p>}
      </>}
    </div> : <div className="memory-write-field">
      <label htmlFor="memory-contribution">내 이야기</label>
      <textarea id="memory-contribution" value={text} onChange={(event) => setText(event.target.value)} maxLength={maxLength} rows={4} placeholder="내가 기억하는 장면을 적어 주세요" autoFocus />
      <span>{text.length}/{maxLength}</span>
      {audio && <audio controls src={audio.url} aria-label="함께 남길 녹음" />}
    </div>}
    {error && <p role="alert" className="memory-error">{error}</p>}
    {transcribing && <p role="status" className="memory-sheet-hint">녹음을 글로 옮기고 있어요…</p>}
    {(mode === 'text' || audio) && <Button className="memory-save" onClick={() => void save()} disabled={(!text.trim() && !audio) || recorder.recording || starting || transcribing || saving}>{saving ? '저장 중…' : kind === 'reply' ? '답가 남기기' : '기억 남기기'}</Button>}
    <button type="button" className="memory-text-link memory-mode-link" disabled={starting || transcribing || saving} onClick={() => { recorder.cancel(); setMode(mode === 'voice' ? 'text' : 'voice') }}>{mode === 'voice' ? '지금 말하기 어려워요 → 글로 답하기' : '말로 답하기'}</button>
  </BottomSheet>
}
