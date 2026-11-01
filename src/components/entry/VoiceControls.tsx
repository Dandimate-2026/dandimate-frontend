import { formatDuration } from '../../hooks/useVoiceRecorder'
import { MicIcon } from './EntryIcons'

// 녹음 중 파형 막대 높이 (시안 그대로)
const WAVE_BARS = [6, 10, 8, 14, 20, 14, 8, 16, 24, 16, 10, 6, 10, 8, 6]

/** 녹음한 시간만큼 파형 막대가 차오르고, 옆에 "0:12 / 1:00"을 보여준다 */
export function WaveProgress({ elapsedMs, maxMs }: { elapsedMs: number; maxMs: number }) {
  const filledBars = Math.ceil((elapsedMs / maxMs) * WAVE_BARS.length)

  return (
    <div className="flex h-6 items-center gap-3">
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
        {formatDuration(elapsedMs)} / {formatDuration(maxMs)}
      </span>
    </div>
  )
}

/** 대기 중에는 마이크, 녹음 중에는 멈춤 버튼 */
export function RecordButton({
  recording,
  disabled,
  onStart,
  onStop,
}: {
  recording: boolean
  disabled?: boolean
  onStart: () => void
  onStop: () => void
}) {
  if (recording) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="녹음 멈추기"
        className="flex size-[61px] items-center justify-center rounded-full border-[3px] border-[#f6e3ea] bg-point"
      >
        <span className="size-[18px] rounded bg-surface" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      aria-label="녹음 시작"
      className="flex size-16 items-center justify-center rounded-full bg-ink text-surface disabled:opacity-60"
    >
      <MicIcon />
    </button>
  )
}
