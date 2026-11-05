import { formatDuration } from '../../hooks/useVoiceRecorder'
import Button from '../Button'
import { useEffect, useRef, useState } from 'react'
import { PencilIcon, PlayIcon, RetryIcon, StopIcon } from './EntryIcons'

export interface VoiceDraft {
  transcriptionId: string
  durationMs: number
  audioUrl: string
}

/**
 * 받아 적은 글 확인 · 글로 직접 쓰기.
 * 아래 버튼을 바닥에 붙이므로 flex-col 부모 안에 둔다.
 */
function AnswerForm({
  transcript,
  maxLength,
  voice,
  error,
  saving,
  confirmLabel,
  onChange,
  onRetry,
  onConfirm,
}: {
  transcript: string
  maxLength: number
  /** 음성으로 받아 적었을 때만 있다. 없으면 글로 쓰는 중 */
  voice: VoiceDraft | null
  error: string | null
  saving: boolean
  confirmLabel: string
  onChange: (text: string) => void
  onRetry: () => void
  onConfirm: () => void
}) {
  // 다시 듣기 중인 오디오. 같은 버튼으로 정지하고, 다시 누르면 멈춘 곳부터 이어 듣는다
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  // 중간에 멈춰 둔 상태 (버튼 글자를 '이어 듣기'로 보여준다)
  const [paused, setPaused] = useState(false)

  /** 재생을 끝내고 처음으로 되돌린다 (다시 녹음·화면 이동) */
  const resetPlayback = () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlaying(false)
    setPaused(false)
  }

  const togglePlayback = () => {
    if (!voice) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      setPaused(true)
      return
    }
    if (!audioRef.current || audioRef.current.src !== voice.audioUrl) {
      audioRef.current?.pause()
      audioRef.current = new Audio(voice.audioUrl)
    }
    const audio = audioRef.current
    audio.onended = () => {
      audio.currentTime = 0
      setPlaying(false)
      setPaused(false)
    }
    setPlaying(true)
    setPaused(false)
    audio.play().catch(() => setPlaying(false))
  }

  // 화면을 떠나면 재생을 멈춘다
  useEffect(() => () => audioRef.current?.pause(), [])

  return (
    <>
      <div className="mt-3.5 rounded-[20px] border border-line bg-surface px-[19px] pt-3.5 pb-4">
        <div className="flex items-center justify-between text-[11px] text-sub">
          <label htmlFor="entry-text">{voice ? '받아 적은 글 · 눌러서 고칠 수 있어요' : '글로 남기기'}</label>
          {voice ? (
            <span className="flex items-center gap-1">
              <PencilIcon />
              녹음 {formatDuration(voice.durationMs)}
            </span>
          ) : (
            <span>
              {transcript.length}/{maxLength}
            </span>
          )}
        </div>
        <textarea
          id="entry-text"
          value={transcript}
          maxLength={maxLength}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          placeholder="한두 문장이면 충분해요"
          className="mt-2 w-full resize-none bg-transparent text-[13px] leading-[19px] outline-none placeholder:text-muted"
        />
      </div>
      {error && <p className="mt-2 px-1 text-[11px] text-point">{error}</p>}

      <div className="mt-auto pt-8">
        <div className={`grid gap-4 ${voice ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {voice && (
            <Button
              variant="outline"
              onClick={togglePlayback}
              aria-pressed={playing}
              className="flex h-[51px] items-center justify-center gap-2 rounded-full"
            >
              {playing ? <StopIcon /> : <PlayIcon />}
              {playing ? '정지' : paused ? '이어 듣기' : '다시 듣기'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              resetPlayback()
              onRetry()
            }}
            className="flex h-[51px] items-center justify-center gap-2 rounded-full"
          >
            <RetryIcon />
            {voice ? '다시 녹음' : '말로 하기'}
          </Button>
        </div>
        <Button onClick={onConfirm} disabled={!transcript.trim() || saving} className="mt-3 w-full">
          {saving ? '저장하는 중…' : confirmLabel}
        </Button>
      </div>
    </>
  )
}

export default AnswerForm
