import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import { DownloadIcon } from '../../components/ShareIcons'
import { rateParagraph, setAhMatda } from '../../api/memories'
import type { RoomHome, Scroll, ScrollParagraph } from '../../api/types'
import { getParagraphRating, rememberParagraphRating } from '../../lib/paragraphRatings'
import { memoryFlowerColor } from '../../lib/flower'
import { BottomSheet, MemoryCard, MemoryFlower, PhotoSlot, ShareMemoryButton, StoryCard, TripHeading } from './components'
import DownloadSheet from './DownloadSheet'
import { ParagraphStory } from './ScrollDocument'
import TemplatePicker from './TemplatePicker'
import { canUseTemplate, getTemplate, readTemplate, saveTemplate, templateStyle, type ScrollTemplateId } from './templates'
import type { DownloadResult } from './scrollDownload'
import type { ReweaveResult } from './types'

export default function LiveScrollPage({ scroll, home, token, onBack, onReply, onRefresh, onReweave, pendingParagraphId, reweaveResult, completionMessage, onDismissCompletion, onAddStory }: {
  scroll: Scroll
  home: RoomHome
  token: string
  onBack: () => void
  onReply: (paragraph: ScrollParagraph) => void
  onRefresh: () => Promise<void>
  onReweave?: (paragraph: ScrollParagraph) => void
  pendingParagraphId?: string
  reweaveResult?: ReweaveResult
  completionMessage?: string
  onDismissCompletion?: () => void
  onAddStory?: () => void
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState<ScrollParagraph | null>(null)
  const [previous, setPrevious] = useState<ScrollParagraph | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ScrollTemplateId>(() => readTemplate(home.room.id))
  const [pickingTemplate, setPickingTemplate] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState('')
  const savedDownload = useRef<DownloadResult | null>(null)
  const shareUrl = `${window.location.origin}${window.location.pathname}`
  const templateId = canUseTemplate(selectedTemplate, home.room.planType) ? selectedTemplate : 'minimal'
  const template = getTemplate(templateId)
  const storyCount = new Set(scroll.paragraphs.flatMap((paragraph) => paragraph.sources.map((source) => source.entryId))).size
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (pickingTemplate) return <TemplatePicker scroll={scroll} home={home} value={templateId} onClose={() => setPickingTemplate(false)} onSelect={(id) => {
    saveTemplate(home.room.id, id); setSelectedTemplate(id); setPickingTemplate(false); window.scrollTo(0, 0)
  }} />

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
      rememberParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version, score)
      setRatings((value) => ({ ...value, [`${paragraph.id}:${paragraph.version}`]: score }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '평가를 저장하지 못했어요.') }
    finally { setBusy(null) }
  }

  async function shareDownload() {
    const saved = savedDownload.current
    const file = saved ? new File([saved.blob], saved.name, { type: saved.blob.type }) : undefined
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ title: home.room.name, files: [file] })
      else if (navigator.share) await navigator.share({ title: home.room.name, text: '함께 모은 기억을 확인해 주세요.', url: shareUrl })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(shareUrl); setNotice('공유 링크를 복사했어요') }
      else setError('이 브라우저에서는 공유를 사용할 수 없어요. 주소를 복사해 주세요.')
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('공유하지 못했어요. 다시 시도해 주세요.')
    }
  }

  return <main className={`memory-page memory-scroll scroll-live ${templateId !== 'minimal' ? 'has-template' : ''}`} style={templateStyle(templateId)}>
    {templateId !== 'minimal' && <img className="scroll-template-hero" src={template.art} width={360} height={180} alt="" />}
    <TripHeading onBack={onBack} title={home.room.name}
      detail={`${home.room.meetingDate?.replaceAll('-', '.') ?? '모임 날짜 미정'} · 참여 ${scroll.participantCount}/${scroll.memberCount} · 사진 ${scroll.paragraphs.length}장`}
      members={home.members.map((member) => ({ name: member.nickname, color: memoryFlowerColor(member.flowerCode) }))}
      actions={<button type="button" className="scroll-save-button" disabled={!scroll.paragraphs.length || Boolean(pendingParagraphId)} onClick={() => setDownloading(true)}><DownloadIcon />저장</button>}
      notice={notice ? <div className="scroll-toast scroll-toast-inline" role="status"><span>✓ {notice}</span><button type="button" onClick={() => void shareDownload()}>단톡방에 공유</button></div>
        : completionMessage ? <div className="scroll-toast scroll-toast-inline" role="status"><span>{completionMessage}</span><button type="button" onClick={onDismissCompletion}>확인</button></div> : undefined} />
    <div className="scroll-template-control"><button type="button" className="memory-text-link" onClick={() => setPickingTemplate(true)}>템플릿 바꾸기</button></div>
    {error && <p className="memory-error" role="alert">{error}</p>}
    {scroll.paragraphs.length === 0 && <p className="memory-chapter">두루마리에 담긴 문단이 없어요.</p>}
    {scroll.paragraphs.map((paragraph) => {
      const rating = ratings[`${paragraph.id}:${paragraph.version}`] ?? getParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version)
      const changes = reweaveResult?.paragraphId === paragraph.id && reweaveResult.version === paragraph.version ? reweaveResult : undefined
      // 챗봇에서 특정 문단으로 바로 올 때 이 id로 찾아 그 위치로 내린다
      return <section className="memory-chapter" key={paragraph.id} id={`paragraph-${paragraph.id}`}>
      <PhotoSlot label={`${paragraph.photo.uploader.nickname}님의 사진`} src={paragraph.photo.imageUrl} />
      <p className="memory-chapter-meta">{paragraph.photo.uploader.nickname}님이 올린 사진</p>
      <div className={changes ? 'scroll-rewoven' : 'scroll-paragraph-story'}>
      {changes && <div className="scroll-rewoven-heading"><strong>✓ {changes.reply.member.nickname} 님의 답가가 엮였어요</strong><button type="button" className="memory-text-link" onClick={() => setPrevious(changes.previous)}>이전 버전</button></div>}
      <ParagraphStory paragraph={paragraph} changes={changes} />
      <div className="memory-chapter-actions">
        <button type="button" className="memory-reaction" disabled={busy !== null || Boolean(pendingParagraphId)} aria-pressed={Boolean(liked[paragraph.id])} onClick={() => void react(paragraph)}>아 맞다 ! <strong>{paragraph.ahMatdaCount}</strong></button>
        <button type="button" className="memory-reply" disabled={Boolean(pendingParagraphId)} onClick={() => onReply(paragraph)}>답가 남기기 {paragraph.replyCount > 0 && `· ${paragraph.replyCount}`}</button>
        <button type="button" className="memory-original-link" onClick={() => setOriginal(paragraph)}>AI가 엮었어요 · 원문보기</button>
      </div>
      </div>
      {!rating && <MemoryCard className="memory-rating">
        <h2>AI가 내 이야기를 잘 옮겼나요?</h2>
        <fieldset><legend className="sr-only">이 문단 평가</legend><div className="memory-rating-options">{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name={`rating-${paragraph.id}`} value={score} checked={false} disabled={busy !== null || Boolean(pendingParagraphId)} onChange={() => void rate(paragraph, score)} aria-label={`${score}점`} /><span /></label>)}</div></fieldset>
        <div className="memory-rating-scale"><span>다르게 옮겼어요</span><span>딱 내 말이에요</span></div>
      </MemoryCard>}
      {rating !== undefined && rating <= 2 && onReweave && <Button className="scroll-reweave-button" variant="outline" disabled={Boolean(pendingParagraphId) || home.room.quota?.regenerationsRemaining === 0} onClick={() => onReweave(paragraph)}>다시 엮기</Button>}
      {pendingParagraphId === paragraph.id && <p className="memory-sheet-hint" role="status">답가를 반영하고 있어요. 완료되면 두루마리가 갱신돼요.</p>}
      {rating !== undefined && rating <= 2 && home.room.quota?.regenerationsRemaining === 0 && <p className="memory-sheet-hint">재엮기를 모두 사용했어요.</p>}
    </section>})}
    {scroll.paragraphs.length > 0 && <footer className="scroll-complete-footer">
      <div className="scroll-end-flowers" aria-hidden="true"><MemoryFlower color="pink" size={25} /><MemoryFlower color="blue" size={25} /><MemoryFlower color="orange" size={25} /></div>
      <h2>두루마리를 끝까지 읽었어요</h2><p>사진 {scroll.paragraphs.length}장 · 이야기 {storyCount}개가 엮였어요</p>
      <div className="scroll-save-actions"><Button disabled={Boolean(pendingParagraphId)} onClick={() => setDownloading(true)}><DownloadIcon />이미지로 저장</Button><ShareMemoryButton roomName={home.room.name} label="단톡방에 공유" url={shareUrl} /></div>
    </footer>}
    {onAddStory && <section className="memory-more"><h2>더 보태고 싶은 이야기가 있나요?</h2><Button onClick={onAddStory}>사진·이야기 더 올리기</Button></section>}
    {downloading && <DownloadSheet scroll={scroll} home={home} template={templateId} onClose={() => setDownloading(false)} onComplete={(result) => { savedDownload.current = result; setDownloading(false); onDismissCompletion?.(); setNotice('파일 다운로드를 시작했어요'); window.scrollTo(0, 0) }} />}
    {previous && <BottomSheet title="이전 버전" onClose={() => setPrevious(null)}><p className="memory-narrative">{previous.body}</p><button type="button" className="memory-text-link" onClick={() => setPrevious(null)}>닫기</button></BottomSheet>}
    {original && <BottomSheet title="함께 남긴 원문" onClose={() => setOriginal(null)}><div className="memory-original-stories">
      {original.sources.map((source) => <StoryCard key={source.entryId} textOnly story={{ author: source.member.nickname, flower: memoryFlowerColor(source.member.flowerCode), kind: '원문', text: source.quote }} />)}
    </div><button type="button" className="memory-text-link" onClick={() => setOriginal(null)}>닫기</button></BottomSheet>}
  </main>
}
