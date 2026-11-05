import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 녹음 하나를 듣고 멈추고 이어 듣는 재생 상태.
 * - toggle(): 재생 중이면 그 자리에서 멈추고, 멈춘 상태면 멈춘 곳부터 이어서 재생한다
 * - 끝까지 들으면 처음으로 돌아간다
 * - reset(): 멈추고 처음으로 되돌린다 (다시 녹음 등)
 * - 주소가 바뀌거나 화면을 떠나면 자동으로 멈춘다
 *
 * 버튼 글자 예: playing ? '정지' : paused ? '이어 듣기' : '다시 듣기'
 */
export function useAudioPlayback(url: string | null | undefined) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  // 중간에 멈춰 둔 상태
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState(false)

  const reset = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlaying(false)
    setPaused(false)
  }, [])

  // 다른 녹음으로 바뀌거나 화면을 떠나면 이전 녹음을 멈추고 버린다
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      setPlaying(false)
      setPaused(false)
    }
  }, [url])

  const toggle = useCallback(() => {
    if (!url) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      setPaused(true)
      return
    }
    if (!audioRef.current) audioRef.current = new Audio(url)
    const audio = audioRef.current
    audio.onended = () => {
      audio.currentTime = 0
      setPlaying(false)
      setPaused(false)
    }
    setError(false)
    setPlaying(true)
    setPaused(false)
    audio.play().catch(() => {
      setPlaying(false)
      setError(true)
    })
  }, [url, playing])

  return { playing, paused, error, toggle, reset }
}
