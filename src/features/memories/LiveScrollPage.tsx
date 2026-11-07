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
import MoreMenu from '../../components/MoreMenu'
import ScrollUnroll from './ScrollUnroll'
import { canUseTemplate, getTemplate, readTemplate, saveTemplate, templateStyle, type ScrollTemplateId } from './templates'
import type { DownloadResult } from './scrollDownload'
import type { ReweaveResult } from './types'
import { siteUrl } from '../../lib/siteUrl'

export default function LiveScrollPage({ scroll, home, token, onBack, onReply, onRefresh, onReweave, onReweaveLimit, pendingParagraphId, reweaveResult, completionMessage, onDismissCompletion, onAddStory }: {
  scroll: Scroll
  home: RoomHome
  token: string
  onBack: () => void
  onReply: (paragraph: ScrollParagraph) => void
  onRefresh: () => Promise<void>
  onReweave?: (paragraph: ScrollParagraph) => void
  /** 재엮기를 다 썼을 때 한도 바텀시트를 띄운다 */
  onReweaveLimit?: () => void
  pendingParagraphId?: string
  reweaveResult?: ReweaveResult
  completionMessage?: string
  onDismissCompletion?: () => void
  onAddStory?: () => void
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [ratingRetry, setRatingRetry] = useState<{ score: number; paragraphs: ScrollParagraph[] } | null>(null)
  const [ratingError, setRatingError] = useState('')
  const ratingSaving = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState<ScrollParagraph | null>(null)
  const [previous, setPrevious] = useState<ScrollParagraph | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ScrollTemplateId>(() => readTemplate(home.room.id))
  const [pickingTemplate, setPickingTemplate] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState('')
  const savedDownload = useRef<DownloadResult | null>(null)
  const shareUrl = siteUrl(window.location.pathname)
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

  const unratedParagraphs = scroll.paragraphs.filter((paragraph) =>
    (ratings[`${paragraph.id}:${paragraph.version}`] ?? getParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version)) === undefined)
  const reweaveTargets = scroll.paragraphs.filter((paragraph) => {
    const score = ratings[`${paragraph.id}:${paragraph.version}`] ?? getParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version)
    return score !== undefined && score <= 2
  })

  async function rate(score: number) {
    if (busy || ratingSaving.current || pendingParagraphId) return
    ratingSaving.current = true
    setBusy('scroll-rating'); setRatingError('')
    try {
      const targets = ratingRetry ? ratingRetry.paragraphs.filter((target) =>
        scroll.paragraphs.some((paragraph) => paragraph.id === target.id && paragraph.version === target.version)) : unratedParagraphs
      const savedScore = ratingRetry?.score ?? score
      const results = await Promise.allSettled(targets.map(async (paragraph) => {
        await rateParagraph(paragraph.id, token, savedScore)
        rememberParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version, savedScore)
        setRatings((value) => ({ ...value, [`${paragraph.id}:${paragraph.version}`]: savedScore }))
      }))
      const failed = targets.filter((_, index) => results[index].status === 'rejected')
      setRatingRetry(failed.length ? { score: savedScore, paragraphs: failed } : null)
      // 다 평가하면 평가 카드만 사라진다 (감사 문구는 띄우지 않는다)
      if (failed.length) setRatingError('일부 평가를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally { ratingSaving.current = false; setBusy(null) }
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

  const saveButton = <button type="button" className="scroll-save-button" disabled={!scroll.paragraphs.length || Boolean(pendingParagraphId)} onClick={() => setDownloading(true)} aria-label="두루마리 저장"><DownloadIcon />저장</button>

  return <main className={`memory-page memory-scroll scroll-live scroll-design scroll-template-${templateId} has-template`} style={templateStyle(templateId)}>
    <button type="button" className="scroll-cover-back" onClick={onBack} aria-label="뒤로 가기">‹</button>
    <div className="scroll-cover-actions"><button type="button" className="template-change-button" onClick={() => setPickingTemplate(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>템플릿 바꾸기</button>{saveButton}</div>
    {/* 모든 템플릿에 봉을 둔다. 지역·특별 템플릿은 그림 바로 아래에 봉이 걸린다 */}
    {templateId !== 'minimal' && <img className="scroll-template-hero" src={template.art} width={360} height={180} alt="" />}
    <div className="scroll-rod" aria-hidden="true" />
    <TripHeading onBack={onBack} title={home.room.name} separateTitle cover
      detail={`${home.room.meetingDate?.replaceAll('-', '.') ?? '모임 날짜 미정'} · 참여 ${scroll.participantCount}/${scroll.memberCount} · 사진 ${scroll.paragraphs.length}장`}
      members={home.members.map((member) => ({ name: member.nickname, color: memoryFlowerColor(member.flowerCode) }))}
      notice={notice ? <div className="scroll-toast scroll-toast-inline" role="status"><span>✓ {notice}</span><button type="button" onClick={() => void shareDownload()}>단톡방에 공유</button></div>
        : completionMessage ? <div className="scroll-toast scroll-toast-inline" role="status"><span>{completionMessage}</span><button type="button" onClick={onDismissCompletion}>확인</button></div> : undefined} />
    {error && <p className="memory-error" role="alert">{error}</p>}
    {scroll.paragraphs.length === 0 && <p className="memory-chapter">두루마리에 담긴 문단이 없어요.</p>}
    {scroll.paragraphs.map((paragraph) => {
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
        {onReweave && !pendingParagraphId && <span className="scroll-paragraph-more"><MoreMenu label="문단 더 보기" items={[{
          label: '다시 엮기',
          onSelect: () => { if (home.room.quota?.regenerationsRemaining === 0 && onReweaveLimit) onReweaveLimit(); else onReweave(paragraph) },
        }]} /></span>}
      </div>
      </div>
      {pendingParagraphId === paragraph.id && <p className="memory-sheet-hint" role="status">답가를 반영하고 있어요. 완료되면 두루마리가 갱신돼요.</p>}
    </section>})}
    {scroll.paragraphs.length > 0 && <div className="scroll-rod scroll-rod-end" aria-hidden="true" />}
    <ScrollUnroll showRod rememberKey={`${home.room.id}:${home.me.id}:${scroll.id}`} />
    {scroll.paragraphs.length > 0 && <footer className="scroll-complete-footer">
      <div className="scroll-end-flowers" aria-hidden="true"><MemoryFlower color="pink" size={25} /><MemoryFlower color="blue" size={25} /><MemoryFlower color="orange" size={25} /></div>
      <h2>두루마리를 끝까지 읽었어요</h2><p>사진 {scroll.paragraphs.length}장 · 이야기 {storyCount}개가 엮였어요</p>
    </footer>}
    {(unratedParagraphs.length > 0 || ratingRetry) && <MemoryCard className="memory-rating scroll-bottom-rating">
      <h2>AI가 내 이야기를 잘 옮겼나요?</h2>
      <p>두루마리의 문단 {scroll.paragraphs.length}개 기준이에요</p>
      <fieldset><legend className="sr-only">두루마리 평가</legend>
          <div className="memory-rating-options">{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name="scroll-rating" value={score} checked={ratingRetry?.score === score} disabled={busy !== null || Boolean(pendingParagraphId) || Boolean(ratingRetry)} onChange={() => void rate(score)} aria-label={`${score}점`} /><span /></label>)}</div>
          <div className="memory-rating-scale"><span>다르게 옮겼어요</span><span>딱 내 말이에요</span></div>
      </fieldset>
      {busy === 'scroll-rating' && <p role="status">평가를 저장하고 있어요.</p>}
      {ratingError && <p role="alert">{ratingError}</p>}
      {ratingRetry && <button type="button" className="memory-text-link" disabled={busy !== null || Boolean(pendingParagraphId)} onClick={() => void rate(ratingRetry.score)}>평가 저장 다시 시도</button>}
    </MemoryCard>}
    {reweaveTargets.length > 0 && onReweave && <section className="scroll-bottom-reweave">
      <p>AI가 빠뜨린 이야기가 있나요?</p>
      <button type="button" className="scroll-reweave-chip" disabled={Boolean(pendingParagraphId)} onClick={() => {
        if (home.room.quota?.regenerationsRemaining === 0 && onReweaveLimit) { onReweaveLimit(); return }
        // 고르는 시트 없이 바로 재엮기 화면으로: 가장 낮게 평가한 문단부터 (다른 문단은 문단 ⋮ 메뉴로)
        const score = (item: ScrollParagraph) => ratings[`${item.id}:${item.version}`] ?? getParagraphRating(home.room.id, home.me.id, item.id, item.version) ?? 5
        onReweave([...reweaveTargets].sort((a, b) => score(a) - score(b))[0])
      }}>다시 엮기</button>
    </section>}
    {scroll.paragraphs.length > 0 && <div className="scroll-bottom-save">
      <div className="scroll-save-actions"><Button disabled={Boolean(pendingParagraphId)} onClick={() => setDownloading(true)}><DownloadIcon />이미지로 저장</Button><ShareMemoryButton roomName={home.room.name} label="단톡방에 공유" url={shareUrl} /></div>
    </div>}
    {onAddStory && <section className="memory-more"><h2>더 보태고 싶은 이야기가 있나요?</h2><Button onClick={onAddStory}>사진·이야기 더 올리기</Button></section>}
    {downloading && <DownloadSheet scroll={scroll} home={home} template={templateId} onClose={() => setDownloading(false)} onComplete={(result) => { savedDownload.current = result; setDownloading(false); onDismissCompletion?.(); setNotice('파일 다운로드를 시작했어요'); window.scrollTo(0, 0) }} />}
    {previous && <BottomSheet title="이전 버전" onClose={() => setPrevious(null)}><p className="memory-narrative">{previous.body}</p><button type="button" className="memory-text-link" onClick={() => setPrevious(null)}>닫기</button></BottomSheet>}
    {original && <BottomSheet title="함께 남긴 원문" onClose={() => setOriginal(null)}><div className="memory-original-stories">
      {original.sources.map((source) => <StoryCard key={source.entryId} textOnly story={{ author: source.member.nickname, flower: memoryFlowerColor(source.member.flowerCode), kind: '원문', text: source.quote }} />)}
    </div><button type="button" className="memory-text-link" onClick={() => setOriginal(null)}>닫기</button></BottomSheet>}
  </main>
}
