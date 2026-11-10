import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import Button from '../../components/Button'
import { DownloadIcon } from '../../components/ShareIcons'
import { rateParagraph, setAhMatda } from '../../api/memories'
import { updateRoom } from '../../api/rooms'
import type { RoomHome, Scroll, ScrollParagraph } from '../../api/types'
import { getParagraphRating, rememberParagraphRating } from '../../lib/paragraphRatings'
import { memoryFlowerColor } from '../../lib/flower'
import { BottomSheet, MemoryCard, MemoryFlower, PhotoSlot, ShareMemoryButton, StoryCard, TripHeading } from './components'
import DownloadSheet from './DownloadSheet'
import { ParagraphStory } from './ScrollDocument'
import TemplatePicker from './TemplatePicker'
import ScrollUnroll from './ScrollUnroll'
import { canUseTemplate, fromServerTemplate, getTemplate, templateStyle, type ScrollTemplateId } from './templates'
import type { DownloadResult } from './scrollDownload'
import type { ReweaveResult } from './types'
import { siteUrl } from '../../lib/siteUrl'
import { clearPlanReturn } from '../../lib/planReturn'

export default function LiveScrollPage({ scroll, home, token, onBack, onRefresh, onReweave, onReweaveLimit, pendingParagraphId, reweaveResult, completionMessage, onDismissCompletion }: {
  scroll: Scroll
  home: RoomHome
  token: string
  onBack: () => void
  onRefresh: () => Promise<void>
  onReweave?: (paragraph: ScrollParagraph) => void
  /** 재엮기를 다 썼을 때 한도 바텀시트를 띄운다 */
  onReweaveLimit?: () => void
  pendingParagraphId?: string
  reweaveResult?: ReweaveResult
  completionMessage?: string
  onDismissCompletion?: () => void
}) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [ratingRetry, setRatingRetry] = useState<{ score: number; paragraphs: ScrollParagraph[] } | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [reweavePicker, setReweavePicker] = useState(false)
  const [confirmReweave, setConfirmReweave] = useState<ScrollParagraph | null>(null)
  const ratingSaving = useRef(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState<ScrollParagraph | null>(null)
  const [previous, setPrevious] = useState<ScrollParagraph | null>(null)
  // 템플릿은 방 단위로 서버에 저장된다. 방금 고른 값은 서버에서 다시 받아 올 때까지만 먼저 보여 준다
  const [chosenTemplate, setChosenTemplate] = useState<ScrollTemplateId | null>(null)
  const selectedTemplate = chosenTemplate ?? fromServerTemplate(home.room.scrollTemplateId)
  const [pickingTemplate, setPickingTemplate] = useState(() => { if (params.get('templates') === '1') return true; try { return scroll.paragraphs.length > 0 && !localStorage.getItem(`duruduru:template-picked:${home.room.id}:${home.me.id}`) } catch { return scroll.paragraphs.length > 0 } })
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState('')
  const savedDownload = useRef<DownloadResult | null>(null)
  const shareUrl = siteUrl(window.location.pathname)
  const templateId = canUseTemplate(selectedTemplate, home.room.planType) ? selectedTemplate : 'minimal'
  const template = getTemplate(templateId)
  const storyCount = new Set(scroll.paragraphs.flatMap((paragraph) => paragraph.sources.map((source) => source.entryId))).size
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 12_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const closeTemplatePicker = () => {
    clearPlanReturn(home.room.id)
    try { localStorage.setItem(`duruduru:template-picked:${home.room.id}:${home.me.id}`, '1') } catch { /* optional */ }
    setPickingTemplate(false)
    setParams(current => {
      const next = new URLSearchParams(current)
      next.delete('templates'); next.delete('template'); next.delete('templateTab')
      return next
    }, { replace: true, state: location.state })
  }

  if (pickingTemplate) return <TemplatePicker scroll={scroll} home={home} value={templateId} onClose={closeTemplatePicker} onSelect={async (id) => {
    try { await updateRoom(home.room.id, { scrollTemplateId: id }, token); setChosenTemplate(id); closeTemplatePicker(); await onRefresh(); setChosenTemplate(null); window.scrollTo(0, 0) }
    catch (cause) { throw cause instanceof Error ? cause : new Error('템플릿을 저장하지 못했어요.') }
  }} />

  // "아 맞다"를 눌렀는지: 이 화면에서 바꾼 값이 먼저, 없으면 서버가 기억하는 값
  const isLiked = (paragraph: ScrollParagraph) => liked[paragraph.id] ?? Boolean(paragraph.myAhMatda)
  // 평점: 이 화면에서 준 값 → 서버 값(같은 문단 버전일 때만) → 이 기기에 남긴 값
  const ratingOf = (paragraph: ScrollParagraph) =>
    ratings[`${paragraph.id}:${paragraph.version}`]
    ?? (paragraph.myFidelityRating != null && paragraph.ratedParagraphVersion === paragraph.version ? paragraph.myFidelityRating : undefined)
    ?? getParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version)

  async function react(paragraph: ScrollParagraph) {
    if (busy) return
    setBusy(paragraph.id); setError('')
    const next = !isLiked(paragraph)
    try {
      await setAhMatda(paragraph.id, token, next)
      setLiked((value) => ({ ...value, [paragraph.id]: next }))
      await onRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '반응을 저장하지 못했어요.') }
    finally { setBusy(null) }
  }

  const scores = scroll.paragraphs.map(ratingOf)
  const selectedRating = ratingRetry?.score ?? (scores.length > 0 && scores.every((score) => score === scores[0]) ? scores[0] : undefined)
  const reweaveTargets = scroll.paragraphs.filter((paragraph) => {
    const score = ratingOf(paragraph)
    return score !== undefined && score <= 2
  })

  async function rate(score: number) {
    if (busy || ratingSaving.current || pendingParagraphId) return
    ratingSaving.current = true
    setBusy('scroll-rating'); setRatingError('')
    try {
      const targets = ratingRetry ? ratingRetry.paragraphs.filter((target) =>
        scroll.paragraphs.some((paragraph) => paragraph.id === target.id && paragraph.version === target.version)) : scroll.paragraphs.filter((paragraph) => ratingOf(paragraph) !== score)
      const savedScore = ratingRetry?.score ?? score
      const results = await Promise.allSettled(targets.map(async (paragraph) => {
        await rateParagraph(paragraph.id, token, savedScore)
        rememberParagraphRating(home.room.id, home.me.id, paragraph.id, paragraph.version, savedScore)
        setRatings((value) => ({ ...value, [`${paragraph.id}:${paragraph.version}`]: savedScore }))
      }))
      const failed = targets.filter((_, index) => results[index].status === 'rejected')
      setRatingRetry(failed.length ? { score: savedScore, paragraphs: failed } : null)
      if (failed.length) setRatingError('일부 평가를 저장하지 못했어요. 다시 시도해 주세요.')
    } finally { ratingSaving.current = false; setBusy(null) }
  }

  async function shareDownload() {
    const saved = savedDownload.current
    const files = saved ? (saved.files ?? [saved]).map((file) => new File([file.blob], file.name, { type: file.blob.type })) : []
    try {
      if (files.length && navigator.canShare?.({ files })) await navigator.share({ title: home.room.name, files })
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
    <div className="scroll-cover-actions">{saveButton}</div>
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
      <p className="memory-chapter-meta">{paragraph.photo.uploader.id === home.me.id ? '내가 올렸어요' : `${paragraph.photo.uploader.nickname} 님이 올렸어요`}</p>
      <div className={changes ? 'scroll-rewoven' : 'scroll-paragraph-story'}>
      {changes && <div className="scroll-rewoven-heading"><strong>✓ 재엮기 완료 · 보탠 이야기가 반영됐어요</strong><button type="button" className="memory-text-link" onClick={() => setPrevious(changes.previous)}>이전 버전</button></div>}
      <ParagraphStory paragraph={paragraph} changes={changes} />
      <div className="memory-chapter-actions">
        <button type="button" className="memory-reaction" disabled={busy !== null || Boolean(pendingParagraphId)} aria-pressed={isLiked(paragraph)} onClick={() => void react(paragraph)}>나도 이렇게 기억해요 <strong>{paragraph.ahMatdaCount}</strong></button>
        {onReweave && !pendingParagraphId && <button type="button" className="paragraph-reweave-button" disabled={busy !== null} onClick={() => { if (home.room.quota?.regenerationsRemaining === 0 && onReweaveLimit) onReweaveLimit(); else setConfirmReweave(paragraph) }}><span aria-hidden="true">↻</span> 다시 엮기</button>}
      </div>
      <div className="mt-1 text-right"><button type="button" className="memory-original-link" onClick={() => setOriginal(paragraph)}>AI가 엮었어요 · 원문보기</button></div>
      </div>
      {pendingParagraphId === paragraph.id && <p className="memory-sheet-hint" role="status">보탠 이야기로 다시 엮고 있어요. 완료되면 두루마리가 갱신돼요.</p>}
    </section>})}
    {scroll.paragraphs.length > 0 && <div className="scroll-rod scroll-rod-end" aria-hidden="true" />}
    <ScrollUnroll showRod />
    {scroll.paragraphs.length > 0 && <footer className="scroll-complete-footer">
      <div className="scroll-end-flowers" aria-hidden="true"><MemoryFlower color="pink" size={25} /><MemoryFlower color="blue" size={25} /><MemoryFlower color="orange" size={25} /></div>
      <h2>두루마리를 끝까지 읽었어요</h2><p>사진 {scroll.paragraphs.length}장 · 이야기 {storyCount}개가 엮였어요</p>
    </footer>}
    {scroll.paragraphs.length > 0 && <MemoryCard className="memory-rating scroll-bottom-rating">
      <h2>AI가 내 이야기를 잘 옮겼나요?</h2>
      <p>두루마리의 문단 {scroll.paragraphs.length}개 기준이에요</p>
      <fieldset><legend className="sr-only">두루마리 평가</legend>
          <div className="memory-rating-options">{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name="scroll-rating" value={score} checked={selectedRating === score} disabled={busy !== null || Boolean(pendingParagraphId) || Boolean(ratingRetry)} onChange={() => void rate(score)} aria-label={`${score}점`} /><span /></label>)}</div>
          <div className="memory-rating-scale"><span>다르게 옮겼어요</span><span>딱 내 말이에요</span></div>
      </fieldset>
      {busy === 'scroll-rating' && <p role="status">평가를 저장하고 있어요.</p>}
      {busy !== 'scroll-rating' && selectedRating !== undefined && !ratingRetry && <p role="status">선택한 평가: {selectedRating}점 · 다시 선택해서 바꿀 수 있어요.</p>}
      {selectedRating === undefined && scores.some((score) => score !== undefined) && <p>문단별 평가가 달라요. 점수를 선택하면 전체 평가를 바꿀 수 있어요.</p>}
      {ratingError && <p role="alert">{ratingError}</p>}
      {ratingRetry && <button type="button" className="memory-text-link" disabled={busy !== null || Boolean(pendingParagraphId)} onClick={() => void rate(ratingRetry.score)}>평가 저장 다시 시도</button>}
    </MemoryCard>}
    {reweaveTargets.length > 0 && onReweave && <section className="scroll-bottom-reweave">
      <p>AI가 빠뜨린 이야기가 있나요?</p>
      <button type="button" className="scroll-reweave-chip" disabled={busy !== null || Boolean(ratingRetry) || Boolean(pendingParagraphId)} onClick={() => {
        if (home.room.quota?.regenerationsRemaining === 0 && onReweaveLimit) { onReweaveLimit(); return }
        setReweavePicker(true)
      }}>다시 엮기</button>
    </section>}
    {scroll.paragraphs.length > 0 && <div className="scroll-bottom-save">
      <button type="button" className="template-change-button mb-3" onClick={() => setPickingTemplate(true)}>템플릿 변경하기<span aria-hidden="true">›</span></button>
      <div className="scroll-save-actions"><Button disabled={Boolean(pendingParagraphId)} onClick={() => setDownloading(true)}><DownloadIcon />이미지로 저장</Button><ShareMemoryButton roomName={home.room.name} label="단톡방에 공유" url={shareUrl} /></div>
    </div>}
    {reweavePicker && onReweave && <BottomSheet title="다시 엮을 문단 선택" onClose={() => setReweavePicker(false)}><p className="memory-sheet-hint">고치고 싶은 문단을 골라 주세요.</p>{reweaveTargets.map((paragraph) => <button type="button" className="reweave-paragraph-option" key={paragraph.id} onClick={() => { setReweavePicker(false); setConfirmReweave(paragraph) }}><strong>문단 {scroll.paragraphs.findIndex((item) => item.id === paragraph.id) + 1} · {paragraph.photo.uploader.nickname}님의 사진</strong><span>{paragraph.body}</span></button>)}</BottomSheet>}
    {confirmReweave && onReweave && <BottomSheet title="이 문단을 다시 엮을까요?" onClose={() => setConfirmReweave(null)}>
      <p className="memory-sheet-hint">다음 화면에서 고치거나 보탤 이야기를 적어 주세요. 작성 후 재엮기를 시작하면 1회를 사용해요.</p>
      {home.room.quota?.regenerationsRemaining !== undefined && <p className="mt-3 text-[13px] font-semibold">재엮기 {home.room.quota.regenerationsRemaining}회 남음</p>}
      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setConfirmReweave(null)}>취소</Button><Button onClick={() => { const target = confirmReweave; setConfirmReweave(null); onReweave(target) }}>이야기 고치러 가기</Button></div>
    </BottomSheet>}
    {downloading && <DownloadSheet scroll={scroll} home={home} template={templateId} onClose={() => setDownloading(false)} onComplete={(result) => { savedDownload.current = result; onDismissCompletion?.(); setNotice('파일을 준비했어요. 저장 또는 공유를 눌러 주세요.'); }} />}
    {previous && <BottomSheet title="이전 버전" onClose={() => setPrevious(null)}><p className="memory-narrative">{previous.body}</p><button type="button" className="memory-text-link" onClick={() => setPrevious(null)}>닫기</button></BottomSheet>}
    {original && <BottomSheet title="함께 남긴 원문" onClose={() => setOriginal(null)}><div className="memory-original-stories">
      {original.sources.map((source) => <StoryCard key={source.entryId} textOnly story={{ author: source.member.nickname, flower: memoryFlowerColor(source.member.flowerCode), kind: '원문', text: source.quote }} />)}
    </div><button type="button" className="memory-text-link" onClick={() => setOriginal(null)}>닫기</button></BottomSheet>}
  </main>
}
