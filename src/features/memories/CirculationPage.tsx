import { copyForShare, shareWithDevice } from '../../lib/share'
import { siteUrl } from '../../lib/siteUrl'
import Button from '../../components/Button'
import MoreMenu from '../../components/MoreMenu'
import lock from '../../assets/memories/lock.svg'
import { MemoryCard, MemoryFlower, MemoryHeader, PhotoSlot, StoryCard, TextModeToggle } from './components'
import type { MemoryPhoto, MemoryResponse, MemoryStory } from './types'

export default function CirculationPage({ photo, position, total, single = false, embedded = false, readOnly = false, response, locked, busy = false, error, textOnly, onTextMode, onBack, onAdd, onNext, onDeletePhoto, onPlace, onEditStory, onDeleteStory }: {
  photo: MemoryPhoto
  position: number
  total: number
  /** 사진 하나만 콕 집어 들어왔을 때: 몇 번째 표시와 다음 사진 없이 그 사진만 */
  embedded?: boolean
  readOnly?: boolean
  single?: boolean
  response?: MemoryResponse
  locked?: boolean
  busy?: boolean
  error?: string
  textOnly: boolean
  onTextMode: (value: boolean) => void
  onBack: () => void
  onAdd: () => void
  onPass?: () => void
  onNext: () => void
  /** 내 사진 지우기 */
  onDeletePhoto?: () => void
  onPlace?: () => void
  /** 내가 남긴 이야기 고치기·지우기 */
  onEditStory?: (story: MemoryStory) => void
  onDeleteStory?: (story: MemoryStory) => void
}) {
  // 내가 남긴 이야기 아래에 [고치기 · 지우기]를 붙인다
  const withActions = (story: MemoryStory, key?: string, first = false) => (
    <div key={key} className="relative">
      <StoryCard story={story} textOnly={textOnly} mine={story.mine} mineLabel={first ? '내 첫 한마디' : '내 덧붙임'} />
      {/* 내가 남긴 이야기: 오른쪽 위 ⋮ 메뉴에서 고치기·지우기 */}
      {story.mine && story.id && (onEditStory || onDeleteStory) && (
        <div className="absolute top-1.5 right-1.5">
          <MoreMenu
            label="내 이야기 메뉴"
            items={[
              ...(onEditStory ? [{ label: '고치기', onSelect: () => onEditStory(story) }] : []),
              ...(onDeleteStory ? [{ label: '지우기', onSelect: () => onDeleteStory(story), danger: true }] : []),
            ]}
          />
        </div>
      )}
    </div>
  )
  // 패스한 사진은 내 이야기를 남긴 게 아니라서 다른 사람 이야기를 열지 않는다 (덧붙여야 열린다)
  const passed = response?.status === 'passed'
  const unlocked = !passed && (locked === undefined ? Boolean(response) : !locked)
  const Container = embedded ? 'article' : 'main'
  return <Container className={embedded ? 'memory-feed-card' : 'memory-page memory-circulation'}>
    {!embedded && <MemoryHeader progress={single ? undefined : `${position} / ${total}`} onBack={onBack} />}
    {!embedded && <TextModeToggle value={textOnly} onChange={onTextMode} />}
    <MemoryCard className="memory-photo-card">
      <div className="memory-photo-owner"><span><MemoryFlower color={photo.flower} />{photo.mine ? '내가 올린 사진' : `${photo.owner} 님이 올렸어요`}</span><span className="flex items-center gap-1"><small>이야기 {1 + photo.friends.length}개</small>{photo.mine && onDeletePhoto && <MoreMenu label="내 사진 메뉴" items={[{ label: '사진 지우기', onSelect: onDeletePhoto, danger: true }]} />}</span></div>
      <PhotoSlot label={photo.location} date={photo.dateLabel} src={photo.photoUrl} icon onDelete={photo.mine ? onDeletePhoto : undefined} onShare={() => {
        const url = siteUrl(`${window.location.pathname}?photo=${encodeURIComponent(photo.id)}`)
        void shareWithDevice('함께 남긴 사진과 이야기를 보세요', url).then(shared => { if (!shared) return copyForShare('함께 남긴 사진과 이야기를 보세요', url) })
      }} />
      <p className="mt-1 text-right text-[10px] text-sub">친구들만 볼 수 있어요 · 왼쪽으로 밀어 공유{photo.mine && onDeletePhoto ? ' · 오른쪽으로 밀어 삭제' : ''}</p>
      <div className="mt-2 flex min-h-9 items-center gap-2 text-[12px] text-sub"><span className="min-w-0 break-words">{photo.location}</span>{onPlace && <button type="button" disabled={busy} onClick={onPlace} className="shrink-0 px-1 py-2 font-semibold text-point underline underline-offset-2">{photo.location === '장소 미등록' ? '추가' : '변경'}</button>}</div>
      <details className="memory-story-disclosure" key={photo.id}>
        <summary className="cursor-pointer py-3 text-[13px]">
          <span className="block text-[12px] font-semibold"><span className="disclosure-closed">이야기 펼치기</span><span className="disclosure-open">이야기 접기</span> · {1 + photo.friends.length}개</span>
          <span className="mt-1 block line-clamp-2 text-sub">{photo.firstStory.text}</span>
        </summary>
      <div className="memory-stories" key={`${photo.id}-${textOnly}`}>
        {withActions(photo.firstStory, undefined, true)}
        {unlocked ? <>
          {photo.friends.map((story, i) => withActions(story, story.id ?? `${story.author}-${i}`))}
          {response?.status === 'added' && !photo.friends.some((story) => story.mine) && (response.contribution ? <StoryCard mine textOnly={textOnly} story={{ ...response.contribution, author: '나', flower: 'orange', kind: response.contribution.audioUrl ? '말로 남김' : '글로 남김' }} /> : <p className="memory-passed">내 덧붙임을 남겼어요</p>)}
        </> : <><div className="memory-locked"><img src={lock} width={21} height={21} alt="" /><p>내 기억부터 남기면 열려요</p><small>친구 이야기 {photo.friends.length}개가 기다리고 있어요</small></div></>}
      </div>
      </details>
    </MemoryCard>
    {error && <p role="alert" className="memory-error">{error}</p>}
    <footer className={embedded ? 'memory-feed-actions' : 'memory-actions'}>
      {/* 덧붙임은 개수 제한 없이, 돌려보는 시간 안이면 몇 번이든 더 남길 수 있다 (시간이 끝나면 두루마리 답가로) */}
      {!readOnly && <Button onClick={onAdd} disabled={busy}>{response?.status === 'added' ? '더 덧붙이기' : '덧붙이기'}</Button>}
      {!embedded && <Button variant="outline" disabled={busy} onClick={onNext}>{single ? '돌아가기' : '다음 사진'}</Button>}
    </footer>
  </Container>
}
