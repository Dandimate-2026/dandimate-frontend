import { useCallback, useEffect, useRef, useState } from 'react'

// 브라우저마다 녹음할 수 있는 형식이 달라 지원되는 첫 번째 형식을 쓴다 (iOS는 mp4, 그 외는 webm)
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export interface Recording {
  blob: Blob
  durationMs: number
}

/**
 * 마이크 녹음. maxMs가 지나면 자동으로 멈추고, 멈출 때마다 onFinish로 결과를 넘긴다.
 */
export function useVoiceRecorder({ maxMs, onFinish }: { maxMs: number; onFinish: (recording: Recording) => void }) {
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const startedAtRef = useRef(0)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  const releaseMic = () => {
    window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  /** 마이크 권한이 없거나 녹음을 지원하지 않으면 예외를 던진다 */
  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      const durationMs = Math.min(Date.now() - startedAtRef.current, maxMs)
      releaseMic()
      setRecording(false)
      onFinishRef.current({ blob: new Blob(chunks, { type: recorder.mimeType }), durationMs })
    }

    streamRef.current = stream
    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setRecording(true)
    recorder.start()

    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current
      setElapsedMs(Math.min(elapsed, maxMs))
      if (elapsed >= maxMs) stop()
    }, 200)
  }, [maxMs, stop])

  // 화면을 떠나면 마이크를 끈다
  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      releaseMic()
    },
    [],
  )

  return { recording, elapsedMs, start, stop }
}

/** 12000 → "0:12" */
export function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
