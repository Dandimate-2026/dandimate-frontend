import { useEffect, useRef, useState, type ReactNode } from 'react'
import Card from '../../components/Card'
import { ChevronLeftIcon, ImagePlaceholderIcon, PlayIcon } from '../../components/entry/EntryIcons'
import { ShareIcon } from '../../components/ShareIcons'
import type { FlowerCode } from '../../api/types'
import Flower from '../../components/Flower'
import type { FlowerColor, MemoryStory } from './types'
import { useSheetDrag } from '../../hooks/useSheetDrag'
import { ViewablePhoto } from '../../components/PhotoViewer'

const LEGACY: Record<'pink' | 'blue' | 'orange', FlowerCode> = { pink: 'AZALEA', blue: 'ROYAL_AZALEA', orange: 'FORSYTHIA' }

/** 기억 화면의 꽃. 앱 공통 8색 꽃으로 그린다 */
export function MemoryFlower({ color, size = 21 }: { color: FlowerColor; size?: number }) {
  const code = color in LEGACY ? LEGACY[color as keyof typeof LEGACY] : (color as FlowerCode)
  return (
    <span className="memory-flower inline-flex" aria-hidden="true">
      <Flower code={code} size={size} />
    </span>
  )
}

export function MemoryHeader({ title = '돌려보기', progress, onBack }: { title?: string; progress?: string; onBack: () => void }) {
  return <header className="memory-header"><button type="button" className="memory-back" onClick={onBack} aria-label={`${title} · 뒤로 가기`}><ChevronLeftIcon /><span>{title}</span></button>{progress && <span className="memory-progress" aria-label={`사진 ${progress}`}>{progress}</span>}</header>
}

export function MemoryCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`memory-card ${className}`}>{children}</Card>
}

export function PhotoSlot({ label, date, src, icon = false, onShare, onDelete }: { label: string; date?: string; src?: string; icon?: boolean; onShare?: () => void; onDelete?: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  return <div className={`memory-photo ${src ? 'has-photo' : ''}`} style={{ touchAction: 'pan-y' }}
    onTouchStart={event => { const point = event.touches[0]; start.current = { x: point.clientX, y: point.clientY }; swiped.current = false }}
    onTouchEnd={event => {
      if (!start.current) return
      const point = event.changedTouches[0]
      const dx = point.clientX - start.current.x, dy = point.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      const action = dx < 0 ? onShare : onDelete
      if (action) { swiped.current = true; action() }
    }}
    onClickCapture={event => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false } }}>
    {src ? <ViewablePhoto src={src} alt={label} /> : <div className="memory-photo-label">{icon && <ImagePlaceholderIcon />}<span>사진 · {label}</span></div>}
    {date && <span className="memory-photo-date">{date}</span>}
  </div>
}

export function TextModeToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return <label className="memory-text-mode"><span>지금 소리를 못 들어요 &gt; 글로 보기</span><input type="checkbox" role="switch" checked={value} onChange={(event) => onChange(event.target.checked)} /><span className="memory-switch" aria-hidden="true" /></label>
}

export function StoryCard({ story, mine = false, textOnly = false, mineLabel = '내 덧붙임' }: { story: MemoryStory; mine?: boolean; textOnly?: boolean; mineLabel?: string }) {
  return <StoryCardPlayback key={`${textOnly}:${story.audioUrl ?? ''}:${story.text}`} story={story} mine={mine} textOnly={textOnly} mineLabel={mineLabel} />
}

function StoryCardPlayback({ story, mine, textOnly, mineLabel }: { story: MemoryStory; mine: boolean; textOnly: boolean; mineLabel: string }) {
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const starting = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; audioRef.current?.pause(); if (speechRef.current) window.speechSynthesis?.cancel() }
  }, [])

  async function play() {
    if (starting.current) return
    if (playing) {
      audioRef.current?.pause()
      if (speechRef.current) window.speechSynthesis?.cancel()
      speechRef.current = null
      setPlaying(false)
      return
    }
    if (story.audioUrl) {
      starting.current = true
      setMessage('')
      const audio = new Audio(story.audioUrl)
      audioRef.current = audio
      audio.onended = () => setPlaying(false)
      audio.onerror = () => { if (active.current) { setPlaying(false); setMessage('음성을 재생하지 못했어요. 글로 확인해 주세요.') } }
      try { await audio.play(); if (active.current) setPlaying(true); else audio.pause() }
      catch { if (active.current) setMessage('음성을 재생하지 못했어요. 글로 확인해 주세요.') }
      finally { starting.current = false }
    } else if ('speechSynthesis' in window && story.text) {
      window.speechSynthesis.cancel()
      const speech = new SpeechSynthesisUtterance(story.text)
      speech.lang = 'ko-KR'
      speech.onend = () => setPlaying(false)
      speech.onerror = () => { setPlaying(false); setMessage('글 읽기를 사용할 수 없어요.') }
      speechRef.current = speech
      setMessage('원본 음성이 없어 글을 읽어드려요.')
      setPlaying(true)
      window.speechSynthesis.speak(speech)
    } else setMessage('이 브라우저에서는 글로 확인해 주세요.')
  }

  return <article className={`memory-story ${story.durationLabel ? 'has-duration' : ''} ${mine ? 'is-mine' : ''} ${textOnly ? 'text-only' : ''}`}>
    {!textOnly && <button type="button" className="memory-play" onClick={() => void play()} aria-label={`${mine ? '내 덧붙임' : story.author} 이야기 ${playing ? '멈추기' : '듣기'}`} aria-pressed={playing}>{playing ? <span>Ⅱ</span> : <PlayIcon />}</button>}
    <div className="memory-story-content">
      <div className="memory-story-author">{story.flower && <MemoryFlower color={story.flower} size={18} />}<span>{mine ? mineLabel : story.author} · {story.kind}{story.durationLabel ? ` · ${story.durationLabel}` : ''}</span></div>
      <p>{story.text || '음성으로 남긴 이야기예요.'}</p>
      {!textOnly && message && <span className="memory-audio-note" role="status">{message}</span>}
    </div>
  </article>
}

export function TripHeading({ onBack, title = '경주 1박2일', detail = '2026. 10. 17–18 · 참여 3/3 · 사진 6장', members, actions, notice, separateTitle = false, cover = false }: { onBack: () => void; title?: string; detail?: string; members?: { name: string; color: FlowerColor }[]; actions?: ReactNode; notice?: ReactNode; separateTitle?: boolean; cover?: boolean }) {
  return <header className="memory-trip-heading">
    <div className="memory-trip-topline">{separateTitle ? <>{!cover && <button type="button" className="memory-back" onClick={onBack} aria-label="뒤로 가기"><ChevronLeftIcon /></button>}<h1>{title}</h1></> : <button type="button" className="memory-back" onClick={onBack} aria-label={`${title} · 뒤로 가기`}><ChevronLeftIcon /><h1>{title}</h1></button>}{actions}</div>
    <p>{detail}</p>
    {notice && <div className="memory-toast-anchor">{notice}</div>}
    <ul className="memory-members">{(members ?? [{ name: '서연', color: 'pink' }, { name: '지수', color: 'blue' }, { name: '민지', color: 'orange' }]).map(({ name, color }) => <li key={name}><MemoryFlower color={color} size={25} /><span className="memory-member-name">{name}</span></li>)}</ul>
  </header>
}

export function BottomSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    dialog?.querySelector('h2')?.focus({ preventScroll: true })
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = old; previous?.focus() }
  }, [])
  const sheetDrag = useSheetDrag(onClose)
  return <dialog ref={dialogRef} className="memory-sheet" style={sheetDrag.sheetStyle} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    if (event.clientY < box.top || event.clientX < box.left || event.clientX > box.right) onClose()
  }}><div className="memory-sheet-body"><button type="button" className="memory-sheet-close" {...sheetDrag.handleProps} onClick={onClose} aria-label="닫기"><span /></button><h2 tabIndex={-1}>{title}</h2>{children}</div></dialog>
}

export function ShareMemoryButton({ label = '단톡방에 알리기', roomName = '경주 1박2일', url }: { label?: string; roomName?: string; url?: string }) {
  const [message, setMessage] = useState('')
  async function share() {
    const text = `${roomName}, 함께 모은 기억을 확인해 주세요.`
    try {
      if (navigator.share) await navigator.share({ title: `두루두루 · ${roomName}`, text, ...(url ? { url } : {}) })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text}${url ? `\n${url}` : ''}`); setMessage(url ? '공유 링크를 복사했어요.' : '공유 문구를 복사했어요.') }
      else setMessage(`${text}${url ? `\n${url}` : ''}`)
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('공유하지 못했어요. 다시 시도해 주세요.') }
  }
  return <div className="memory-share"><button type="button" onClick={() => void share()}><ShareIcon />{label}</button>{message && <p role="status">{message}</p>}</div>
}
