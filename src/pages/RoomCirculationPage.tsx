import { getRoomHome } from '../api/rooms'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { createEntry, deleteEntry, editEntry, transcribe } from '../api/entries'
import PlaceSheet from '../components/PlaceSheet'
import { setPhotoLocation, type Place } from '../api/places'
import { deletePhoto } from '../api/photos'
import { getCirculation, getCirculationPage, undoPass } from '../api/memories'
import type { CirculationCard, Entry, FlowerCode, RoomHome } from '../api/types'
import Button from '../components/Button'
import CirculationPage from '../features/memories/CirculationPage'
import { CirculationComplete } from '../features/memories/CompletionPages'
import ContributionSheet from '../features/memories/ContributionSheet'
import { voiceMaxMs } from '../hooks/useRoomQuota'
import { MemoryFlower, MemoryHeader, TextModeToggle } from '../features/memories/components'
import type { FlowerColor, MemoryContribution, MemoryPhoto, MemoryResponse, MemoryStory } from '../features/memories/types'
import '../features/memories/memories.css'
import { getRoomSession } from '../lib/session'
import { paths } from '../routes/paths'
import NotFoundPage from './NotFoundPage'
import { LengthNotice } from '../components/LengthNotice'
import { canEditRoomRecords } from '../lib/roomState'
import { useRoomLiveUpdates } from '../hooks/useRoomLiveUpdates'
import { clampText } from '../lib/textLimit'

/** 꽃 색은 앱 공통 8색: 꽃 코드를 그대로 쓴다 */
function flower(code: FlowerCode): FlowerColor {
  return code
}

function story(entry: Entry, myMemberId?: string) {
  return {
    id: entry.id,
    mine: Boolean(myMemberId && entry.member.id === myMemberId),
    author: entry.member.nickname,
    flower: flower(entry.member.flowerCode),
    kind: entry.inputMode === 'VOICE' ? '말로 남김' : '글로 남김',
    text: entry.transcript,
    audioUrl: entry.audioUrl ?? undefined,
  }
}

function isOwnPhoto(card: CirculationCard, myMemberId?: string) {
  return card.myResponse.status === 'OWN_PHOTO' || Boolean(myMemberId && String(card.photo.uploader.id) === String(myMemberId))
}

function memoryPhoto(card: CirculationCard, myMemberId?: string): MemoryPhoto {
  return {
    id: card.photo.id,
    mine: isOwnPhoto(card, myMemberId),
    owner: card.photo.uploader.nickname,
    flower: flower(card.photo.uploader.flowerCode),
    location: card.photo.location?.placeName?.trim() || '장소 미등록',
    dateLabel: card.firstEntry?.confirmedAt.slice(0, 10).replaceAll('-', '.') ?? '',
    photoUrl: card.photo.imageUrl,
    firstStory: card.firstEntry ? story(card.firstEntry, myMemberId) : { author: card.photo.uploader.nickname, kind: '첫 한마디', text: '아직 첫 이야기가 없어요.' },
    friends: card.otherEntries.filter((entry, i, entries) => entry.id !== card.firstEntry?.id && entries.findIndex(item => item.id === entry.id) === i).map((entry) => story(entry, myMemberId)),
  }
}

/** Continue past own-only pages so the friend feed does not appear empty. */
async function loadFriendBatch(roomId: string, token: string, cursor?: string, minimumPages = 1, current = () => true) {
  const cards: CirculationCard[] = []
  const seen = new Set<string>()
  if (cursor) seen.add(cursor)
  let pages = 0
  do {
    const part = await getCirculationPage(roomId, token, cursor, 6)
    if (!current()) break
    pages++
    cards.push(...part.cards.filter(card => !cards.some(previous => previous.photo.id === card.photo.id)))
    cursor = part.nextCursor ?? undefined
    if (cursor && seen.has(cursor)) throw new Error('사진 목록을 이어서 불러오지 못했어요. 다시 시도해 주세요.')
    if (cursor) seen.add(cursor)
    if (pages >= minimumPages && cards.some(card => card.myResponse.status !== 'OWN_PHOTO')) break
  } while (cursor && current())
  return { cards, nextCursor: cursor ?? null, pages }
}

function RoomCirculationPage() {
  const { roomId = '' } = useParams()
  const navigate = useAppNavigate()
  // 챗봇에서 특정 사진에 덧붙이러 왔으면 그 사진부터 연다
  const [searchParams] = useSearchParams()
  const startPhotoId = searchParams.get('photo')
  const session = getRoomSession(roomId)
  const token = session?.memberAccessToken ?? ''
  // 덧붙임 녹음 최대 길이는 플랜별(20/30/60초)이라 방 한도를 불러온다
  const [roomDetails, setRoomDetails] = useState<{ roomId: string; home: RoomHome | null; error: string } | null>(null)
  const homeSequence = useRef(0)
  const quotaHome = roomDetails?.roomId === roomId ? roomDetails.home : null
  const homeError = roomDetails?.roomId === roomId ? roomDetails.error : ''
  const reloadHome = useCallback(() => {
    const sequence = ++homeSequence.current
    return getRoomHome(roomId, token).then(home => {
      if (sequence === homeSequence.current) setRoomDetails({ roomId, home, error: '' })
    }).catch(() => {
      if (sequence === homeSequence.current) setRoomDetails({ roomId, home: null, error: '방 상태를 확인하지 못했어요. 다시 확인해 주세요.' })
    })
  }, [roomId, token])
  useEffect(() => { void reloadHome(); const sequence = homeSequence; return () => { sequence.current++ } }, [reloadHome])
  const editable = canEditRoomRecords(quotaHome?.room.status)
  const readOnlyMessage = quotaHome && !editable ? (quotaHome.room.status === 'GROWING' ? '두루마리가 완성되어 덧붙이기는 마감됐어요.' : '두루마리를 엮는 중이라 덧붙이기는 마감됐어요.') : homeError
  const canEditPlace = Boolean(quotaHome && quotaHome.room.status !== 'WEAVING')
  const [cards, setCards] = useState<CirculationCard[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageLoads = useRef(1)
  const loadSequence = useRef(0)
  const moreLock = useRef(false)
  const [feedPage, setFeedPage] = useState(1)
  const feedTop = useRef<HTMLDivElement>(null)
  const filteredCards = cards.filter(item => !isOwnPhoto(item, quotaHome?.me.id))
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / pageSize))
  const currentPage = Math.min(feedPage, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const [index, setIndex] = useState(0)
  // 홈·핀 꽃에서 사진 하나를 콕 집어 들어오면 그 사진 하나만 보여 준다
  const [listing, setListing] = useState(!startPhotoId)
  const [placing, setPlacing] = useState<string | null>(null)
  const [single, setSingle] = useState(false)
  const [done, setDone] = useState(false)
  const [responses, setResponses] = useState<Record<string, MemoryContribution>>({})
  const audioUrls = useRef<Set<string>>(new Set())
  const [textOnly, setTextOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const scope = `${roomId}:${startPhotoId ?? ''}`
  const [loadedScope, setLoadedScope] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 내 사진·이야기 지우기 확인창과 이야기 고치기 창
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'photo' } | { kind: 'story'; story: MemoryStory } | null>(null)
  const [editing, setEditing] = useState<{ story: MemoryStory; text: string } | null>(null)

  useEffect(() => {
    const urls = audioUrls.current
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [])

  useEffect(() => {
    let active = true
    const requestState = loadSequence
    const sequence = ++requestState.current
    pageLoads.current = startPhotoId ? Infinity : 1
    const initial = startPhotoId ? getCirculation(roomId, token).then(cards => ({ cards, nextCursor: null, pages: Infinity })) : loadFriendBatch(roomId, token, undefined, 1, () => active && sequence === requestState.current)
    initial.then((result) => {
      if (!active || sequence !== loadSequence.current) return
      pageLoads.current = result.pages
      setError(''); setFeedPage(1); setListing(!startPhotoId); setSingle(false)
      setNextCursor(result.nextCursor ?? null)
      // 내 사진에도 덧붙일 수 있어서 내 사진까지 함께 돌려본다
      const list = result.cards
      setCards(list)
      const start = startPhotoId ? list.findIndex((card) => card.photo.id === startPhotoId) : -1
      if (start >= 0) { setIndex(start); setSingle(true) }
      // 아직 돌려보기에 없는 사진(지워졌거나 첫 한마디 전)이면 첫 사진부터 보여주고 알린다
      else if (startPhotoId) { setListing(true); setError('그 사진은 지금 볼 수 없어요. 목록에서 다른 사진을 골라 주세요') }
    })
      .catch((cause: unknown) => { if (active && sequence === requestState.current) { setCards([]); setNextCursor(null); setError(cause instanceof Error ? cause.message : '사진을 불러오지 못했어요.') } })
      .finally(() => { if (active && sequence === requestState.current) { setLoading(false); setLoadedScope(`${roomId}:${startPhotoId ?? ''}`) } })
    return () => { active = false; requestState.current++ }
  }, [roomId, token, startPhotoId])

  useRoomLiveUpdates(roomId, session?.memberAccessToken, () => {
    void reloadHome()
    if (busy || loading || loadedScope !== scope || moreLock.current) return
    void refresh().catch(() => {})
  })

  if (!session) return <NotFoundPage message="초대 링크로 먼저 들어와 주세요" />

  const card = cards[index]
  const photo = card ? memoryPhoto(card, quotaHome?.me.id) : null
  const response: MemoryResponse | undefined = card?.myResponse.status === 'ADDON'
    ? { status: 'added', contribution: responses[card.photo.id] }
    : card?.myResponse.status === 'PASSED' ? { status: 'passed' } : undefined
  const backToHome = () => navigate(paths.roomHome(roomId))
  const backToList = () => { setListing(true); setSingle(false); setSheetOpen(false) }
  async function savePlace(place: Place) {
    if (!placing || busy || !canEditPlace || !cards.some(item => item.photo.id === placing && isOwnPhoto(item, quotaHome?.me.id))) return
    setBusy(true); setError('')
    try {
      await setPhotoLocation(placing, place)
      await refresh()
      setPlacing(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '장소를 저장하지 못했어요') }
    finally { setBusy(false) }
  }

  async function refresh() {
    const sequence = ++loadSequence.current
    const currentPhotoId = cards[index]?.photo.id
    const batch = await loadFriendBatch(roomId, token, undefined, pageLoads.current, () => sequence === loadSequence.current)
    const result = batch.cards
    const cursor = batch.nextCursor
    if (sequence !== loadSequence.current) return
    pageLoads.current = batch.pages
    setCards(result); setNextCursor(cursor ?? null)
    const next = result.findIndex(item => item.photo.id === currentPhotoId)
    setIndex(next >= 0 ? next : Math.max(0, Math.min(index, result.length - 1)))
  }

  async function loadMore() {
    if (!nextCursor || moreLock.current || busy) return
    moreLock.current = true; setLoadingMore(true); setError('')
    const sequence = ++loadSequence.current
    try {
      const part = await loadFriendBatch(roomId, token, nextCursor, 1, () => sequence === loadSequence.current)
      if (sequence !== loadSequence.current) return
      if (part.nextCursor === nextCursor) throw new Error('다음 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      pageLoads.current += part.pages
      setCards(current => [...current, ...part.cards.filter(item => !current.some(old => old.photo.id === item.photo.id))])
      setNextCursor(part.nextCursor ?? null)
      if (part.cards.some(item => item.myResponse.status !== 'OWN_PHOTO')) {
        setFeedPage(Math.floor(filteredCards.length / pageSize) + 1)
        window.requestAnimationFrame(() => feedTop.current?.scrollIntoView({ block: 'start' }))
      }
    } catch (cause) { if (sequence === loadSequence.current) setError(cause instanceof Error ? cause.message : '사진을 더 불러오지 못했어요.') }
    finally { moreLock.current = false; setLoadingMore(false) }
  }

  async function saveAddition(contribution: MemoryContribution) {
    if (!editable || !card) return
    if (card.myResponse.status === 'PASSED') await undoPass(card.photo.id, token)
    if (contribution.audioBlob && contribution.transcriptionId) {
      await createEntry(card.photo.id, token, { kind: 'ADDON', inputMode: 'VOICE', transcriptionId: contribution.transcriptionId, transcript: contribution.text })
    } else {
      await createEntry(card.photo.id, token, { kind: 'ADDON', inputMode: 'TEXT', transcript: contribution.text })
    }
    await refresh()
    if (contribution.audioUrl) audioUrls.current.add(contribution.audioUrl)
    setResponses((current) => ({ ...current, [card.photo.id]: contribution }))
    setSheetOpen(false)
  }

  function next() {
    setSheetOpen(false)
    // 한 장만 보러 왔으면 다음 사진 대신 왔던 곳으로
    if (single) { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else backToHome(); return }
    if (index >= cards.length - 1) setDone(true)
    else setIndex((value) => value + 1)
    window.scrollTo(0, 0)
  }

  async function retryLoad() {
    setBusy(true)
    setError('')
    try { await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '사진을 불러오지 못했어요.') }
    finally { setBusy(false) }
  }

  async function confirmDeletion() {
    if (!editable || !confirmDelete || !card || busy) return
    setBusy(true); setError('')
    try {
      if (confirmDelete.kind === 'photo') {
        await deletePhoto(card.photo.id)
        // 한 장만 보러 왔으면 그 사진이 없어졌으니 왔던 곳으로
        if (single) { setConfirmDelete(null); navigate(-1); return }
        await refresh()
      } else if (confirmDelete.story.id) {
        await deleteEntry(confirmDelete.story.id)
        await refresh()
      }
      setConfirmDelete(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '지우지 못했어요.')
      setConfirmDelete(null)
    } finally { setBusy(false) }
  }

  async function saveEdit() {
    if (!editable || !editing?.story.id || !editing.text.trim() || busy) return
    setBusy(true); setError('')
    try {
      await editEntry(editing.story.id, editing.text.trim())
      await refresh()
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '고치지 못했어요.')
    } finally { setBusy(false) }
  }

  return <div className="memory-app w-full">
    {loading || loadedScope !== scope ? <main className="memory-page" role="status">사진을 불러오고 있어요…</main>
      : listing && cards.length > 0 ? <main className="memory-page">
          <MemoryHeader title="친구 사진 둘러보기" onBack={backToHome} />
          <section className="circulation-feed-intro" aria-label="사진 둘러보기 안내">
            <p className="text-[12px] leading-5 break-keep text-sub">아래로 넘기며 사진을 둘러보세요.<br />이야기는 펼쳐서 읽을 수 있어요.</p>
            <div className="circulation-feed-toolbar">
              <p className="text-[12px] leading-5 text-sub">{nextCursor ? '불러온 사진' : '사진'} {filteredCards.length}장{pageCount > 1 && <span className="ml-2">· {currentPage} / {pageCount} 페이지</span>}</p>
              <TextModeToggle value={textOnly} onChange={setTextOnly} />
            </div>
          </section>
          {error && <p role="alert" className="mt-3 text-[12px] text-point">{error}</p>}
          <div ref={feedTop} className="scroll-mt-5" />
          {filteredCards.length === 0 && <p className="py-8 text-center text-[13px] text-sub">{nextCursor ? '불러온 사진에는 해당하는 사진이 없어요. 사진을 더 불러와 주세요.' : '아직 이 목록에 사진이 없어요. 내 사진은 모임방의 핀 꽃에서 볼 수 있어요.'}</p>}
          <ul className="mt-4 flex flex-col gap-6">
            {filteredCards.slice(pageStart, pageStart + pageSize).map((item) => { const i = cards.indexOf(item); return <li key={item.photo.id} id={`photo-${item.photo.id}`}>
              <CirculationPage embedded checking={!quotaHome && !homeError} onRetryStatus={homeError ? () => void reloadHome() : undefined} readOnlyMessage={readOnlyMessage} readOnly={!editable} photo={memoryPhoto(item, quotaHome?.me.id)} position={i + 1} total={cards.length}
                response={item.myResponse.status === 'ADDON' ? { status: 'added', contribution: responses[item.photo.id] } : undefined}
                locked={item.locked} busy={busy} textOnly={textOnly} onTextMode={setTextOnly} onBack={backToHome}
                onAdd={() => { setIndex(i); setSheetOpen(true) }} onNext={() => {}}
                onPlace={canEditPlace && isOwnPhoto(item, quotaHome?.me.id) ? () => setPlacing(item.photo.id) : undefined}
                onDeletePhoto={editable ? () => { setIndex(i); setConfirmDelete({ kind: 'photo' }) } : undefined}
                onEditStory={editable ? s => { setIndex(i); setEditing({ story: s, text: s.text }) } : undefined}
                onDeleteStory={editable ? s => { setIndex(i); setConfirmDelete({ kind: 'story', story: s }) } : undefined} />
            </li>})}
          </ul>
          {pageCount > 1 && <nav aria-label="사진 목록 페이지" className="mt-6 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(page => <button key={page} type="button" aria-label={`${page}페이지`} aria-current={page === currentPage ? 'page' : undefined} onClick={() => { setFeedPage(page); feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className={`flex size-11 items-center justify-center rounded-full border text-[13px] ${page === currentPage ? 'border-ink bg-ink text-surface' : 'border-line bg-surface'}`}>{page}</button>)}
          </nav>}
          {nextCursor && <Button variant="outline" className="mt-5 w-full" disabled={loadingMore || busy} onClick={() => void loadMore()}>{loadingMore ? '사진을 불러오는 중…' : '사진 더 불러오기'}</Button>}
        </main>
      : !photo ? <main className="memory-page memory-empty">
          <MemoryHeader onBack={backToHome} />
          <section className="memory-empty-main" role={error ? 'alert' : 'status'}>
            <div className="memory-empty-flower" aria-hidden="true"><MemoryFlower color="pink" size={40} /></div>
            <h1>{error ? '사진을 불러오지 못했어요' : '아직 돌려볼 친구 사진이 없어요'}</h1>
            <p>{error || '친구가 사진과 첫 한마디를 남기면 여기서 이야기를 보탤 수 있어요.'}</p>
          </section>
          <footer className="memory-empty-actions">
            <Button variant="outline" onClick={() => void retryLoad()} disabled={busy}>{busy ? '확인 중…' : '다시 확인하기'}</Button>
            <Button onClick={backToHome}>방으로 돌아가기</Button>
          </footer>
        </main>
        : done ? <CirculationComplete addedCount={cards.filter((item) => item.myResponse.status === 'ADDON').length} photoCount={cards.length} roomName={session.roomName} onBack={() => setDone(false)} onHome={backToHome} />
          : <CirculationPage checking={!quotaHome && !homeError} onRetryStatus={homeError ? () => void reloadHome() : undefined} readOnlyMessage={readOnlyMessage} readOnly={!editable} photo={photo} position={index + 1} total={cards.length} single={single} response={response} locked={card.locked} busy={busy} error={error} textOnly={textOnly} onTextMode={setTextOnly} onBack={() => { if (single) { if ((window.history.state?.idx ?? 0) > 0) navigate(-1); else backToHome() } else backToList() }} onAdd={() => setSheetOpen(true)} onNext={next}
            onPlace={canEditPlace && photo.mine ? () => setPlacing(card.photo.id) : undefined}
            onDeletePhoto={editable ? () => setConfirmDelete({ kind: 'photo' }) : undefined}
            onEditStory={editable ? (s) => setEditing({ story: s, text: s.text }) : undefined}
            onDeleteStory={editable ? (s) => setConfirmDelete({ kind: 'story', story: s }) : undefined} />}
    {placing && <PlaceSheet title="사진을 어디서 찍었나요?" recent={[]} onClose={() => { if (!busy) setPlacing(null) }} onSelect={(_, detail) => { if (detail) void savePlace(detail) }} />}
    {editable && confirmDelete && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-8" onClick={() => setConfirmDelete(null)}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[360px] rounded-[24px] bg-[#fffdf9] px-5 pt-6 pb-5 text-center text-[#2a2623]">
          <h2 id="delete-title" className="text-[16px] font-bold">{confirmDelete.kind === 'photo' ? '이 사진을 지울까요?' : '이 이야기를 지울까요?'}</h2>
          <p className="mt-2 text-[13px] leading-5 text-[#8a8178]">
            {confirmDelete.kind === 'photo'
              ? <>사진에 친구들이 남긴 이야기도 함께 지워져요.<br />지운 사진은 되돌릴 수 없어요.</>
              : <>지운 이야기는 되돌릴 수 없어요.<br />두루마리가 완성된 방이면 문단이 다시 만들어져요.</>}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className="h-12 rounded-full border border-[#e6ded2] text-[15px] font-semibold">취소</button>
            <button type="button" disabled={busy} onClick={() => void confirmDeletion()} className="h-12 rounded-full bg-[#2a2623] text-[15px] font-semibold text-white disabled:opacity-50">{busy ? '지우는 중…' : '지우기'}</button>
          </div>
        </div>
      </div>
    )}
    {editable && editing && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6" onClick={() => setEditing(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="edit-story-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-[380px] rounded-[24px] bg-[#fffdf9] px-5 pt-6 pb-5 text-[#2a2623]">
          <h2 id="edit-story-title" className="text-center text-[16px] font-bold">이야기 고치기</h2>
          <textarea value={editing.text} maxLength={300} onChange={(e) => setEditing({ ...editing, text: clampText(e.target.value, 300) })} rows={4} className="mt-4 w-full resize-none rounded-[16px] border border-[#e6ded2] bg-white px-4 py-3 text-[14px] leading-6 outline-none" />
          <p className="mt-1 text-right text-[11px] text-[#8a8178]">{editing.text.length}/300 · 말로 남긴 이야기는 글만 바뀌어요</p>
          <LengthNotice length={editing.text.length} max={300} className="text-right" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-12 rounded-full border border-[#e6ded2] text-[15px] font-semibold">취소</button>
            <button type="button" disabled={busy || !editing.text.trim()} onClick={() => void saveEdit()} className="h-12 rounded-full bg-[#2a2623] text-[15px] font-semibold text-white disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      </div>
    )}
    {editable && sheetOpen && photo && <ContributionSheet kind="addition" quote={photo.firstStory.text} startWithText={textOnly} draftKey={`addon:${roomId}:${photo.id}`} maxLength={200} maxVoiceMs={voiceMaxMs(quotaHome?.room.quota, 'other')}
      onTranscribe={(audio) => transcribe(photo.id, token, audio, 'ADDON')}
      onSave={saveAddition} onClose={() => setSheetOpen(false)} />}
  </div>
}

export default RoomCirculationPage
