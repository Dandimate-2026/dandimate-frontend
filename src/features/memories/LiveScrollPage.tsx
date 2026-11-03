import { useState } from 'react'
import { rateParagraph, setAhMatda } from '../../api/memories'
import type { RoomHome, Scroll, ScrollParagraph } from '../../api/types'
import { BottomSheet, MemoryCard, PhotoSlot, StoryCard, TripHeading } from './components'
import type { FlowerColor } from './types'

function color(code: string): FlowerColor {
  if (code === 'FORGET_ME_NOT' || code === 'TEAL') return 'blue'
  if (code === 'FORSYTHIA' || code === 'CANOLA') return 'orange'
  return 'pink'
}

export default function LiveScrollPage({ scroll, home, token, onBack, onReply, onRefresh }: {
  scroll: Scroll
  home: RoomHome
  token: string
  onBack: () => void
  onReply: (paragraph: ScrollParagraph) => void
  onRefresh: () => Promise<void>
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState<ScrollParagraph | null>(null)

  async function react(paragraph: ScrollParagraph) {
    if (busy) return
    setBusy(paragraph.id); setError('')
    const next = !liked[paragraph.id]
    try {
      await setAhMatda(paragraph.id, token, next)
      setLiked((value) => ({ ...value, [paragraph.id]: next }))
      await onRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '반응을 저장하지 못했어요.') }
    finally { setBusy(null) }
  }

  async function rate(paragraph: ScrollParagraph, score: number) {
    if (busy) return
    setBusy(paragraph.id); setError('')
    try {
      await rateParagraph(paragraph.id, token, score)
      setRatings((value) => ({ ...value, [paragraph.id]: score }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '평가를 저장하지 못했어요.') }
    finally { setBusy(null) }
  }

  return <main className="memory-page memory-scroll">
    <TripHeading onBack={onBack} title={home.room.name}
      detail={`${home.room.meetingDate?.replaceAll('-', '.') ?? '모임 날짜 미정'} · 참여 ${scroll.participantCount}/${scroll.memberCount} · 사진 ${scroll.paragraphs.length}장`}
      members={home.members.map((member) => ({ name: member.nickname, color: color(member.flowerCode) }))} />
    {error && <p className="memory-error" role="alert">{error}</p>}
    {scroll.paragraphs.length === 0 && <p className="memory-chapter">두루마리에 담긴 문단이 없어요.</p>}
    {scroll.paragraphs.map((paragraph) => <section className="memory-chapter" key={paragraph.id}>
      <PhotoSlot label={`${paragraph.photo.uploader.nickname}님의 사진`} src={paragraph.photo.imageUrl} />
      <p className="memory-chapter-meta">{paragraph.photo.uploader.nickname}님이 올린 사진</p>
      <p className="memory-narrative">{paragraph.body}</p>
      <div className="memory-chapter-actions">
        <button type="button" className="memory-reaction" disabled={busy === paragraph.id} aria-pressed={Boolean(liked[paragraph.id])} onClick={() => void react(paragraph)}>아 맞다 ! <strong>{paragraph.ahMatdaCount}</strong></button>
        <button type="button" className="memory-reply" onClick={() => onReply(paragraph)}>답가 남기기 {paragraph.replyCount > 0 && `· ${paragraph.replyCount}`}</button>
        <button type="button" className="memory-original-link" onClick={() => setOriginal(paragraph)}>AI가 엮었어요 · 원문보기</button>
      </div>
      <MemoryCard className="memory-rating">
        <h2>AI가 내 이야기를 잘 옮겼나요?</h2>
        <fieldset><legend className="sr-only">이 문단 평가</legend><div className="memory-rating-options">{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name={`rating-${paragraph.id}`} value={score} checked={ratings[paragraph.id] === score} disabled={busy === paragraph.id} onChange={() => void rate(paragraph, score)} aria-label={`${score}점`} /><span /></label>)}</div></fieldset>
        <div className="memory-rating-scale"><span>다르게 옮겼어요</span><span>딱 내 말이에요</span></div>
        {ratings[paragraph.id] && <p className="memory-rating-thanks" role="status">평가를 저장했어요.</p>}
      </MemoryCard>
    </section>)}
    {original && <BottomSheet title="함께 남긴 원문" onClose={() => setOriginal(null)}><div className="memory-original-stories">
      {original.sources.map((source) => <StoryCard key={source.entryId} textOnly story={{ author: source.member.nickname, flower: color(source.member.flowerCode), kind: '원문', text: source.quote }} />)}
    </div><button type="button" className="memory-text-link" onClick={() => setOriginal(null)}>닫기</button></BottomSheet>}
  </main>
}
