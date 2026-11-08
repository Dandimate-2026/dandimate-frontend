import Button from '../../components/Button'
import MoreMenu from '../../components/MoreMenu'
import lock from '../../assets/memories/lock.svg'
import skip from '../../assets/memories/skip.svg'
import { MemoryCard, MemoryFlower, MemoryHeader, PhotoSlot, StoryCard, TextModeToggle } from './components'
import type { MemoryPhoto, MemoryResponse, MemoryStory } from './types'

export default function CirculationPage({ photo, position, total, single = false, readOnly = false, response, locked, busy = false, error, textOnly, onTextMode, onBack, onAdd, onPass, onNext, onDeletePhoto, onEditStory, onDeleteStory }: {
  photo: MemoryPhoto
  position: number
  total: number
  /** 사진 하나만 콕 집어 들어왔을 때: 몇 번째 표시와 다음 사진 없이 그 사진만 */
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
  onPass: () => void
  onNext: () => void
  /** 내 사진 지우기 */
  onDeletePhoto?: () => void
  /** 내가 남긴 이야기 고치기·지우기 */
  onEditStory?: (story: MemoryStory) => void
  onDeleteStory?: (story: MemoryStory) => void
}) {
  // 내가 남긴 이야기 아래에 [고치기 · 지우기]를 붙인다
  const withActions = (story: MemoryStory, key?: string) => (
    <div key={key} className="relative">
      <StoryCard story={story} textOnly={textOnly} mine={story.mine} />
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
  return <main className="memory-page memory-circulation">
    <MemoryHeader progress={single ? undefined : `${position} / ${total}`} onBack={onBack} />
    <TextModeToggle value={textOnly} onChange={onTextMode} />
    <MemoryCard className="memory-photo-card">
      <div className="memory-photo-owner"><span><MemoryFlower color={photo.flower} />{photo.mine ? '내가 올렸어요' : `${photo.owner} 님이 올렸어요`}</span><span className="flex items-center gap-1"><small>이야기 {1 + photo.friends.length}개</small>{photo.mine && onDeletePhoto && <MoreMenu label="내 사진 메뉴" items={[{ label: '사진 지우기', onSelect: onDeletePhoto, danger: true }]} />}</span></div>
      <PhotoSlot label={photo.location} date={photo.dateLabel} src={photo.photoUrl} icon />
      <div className="memory-stories" key={`${photo.id}-${textOnly}`}>
        {withActions(photo.firstStory)}
        {unlocked ? <>
          {photo.friends.map((story, i) => withActions(story, story.id ?? `${story.author}-${i}`))}
          {response?.status === 'added' && (response.contribution ? <StoryCard mine textOnly={textOnly} story={{ ...response.contribution, author: '나', flower: 'orange', kind: response.contribution.audioUrl ? '말로 남김' : '글로 남김' }} /> : <p className="memory-passed">내 덧붙임을 남겼어요</p>)}
        </> : <>{passed && <p className="memory-passed"><img src={skip} width={14} height={14} alt="" />이 사진은 패스했어요</p>}<div className="memory-locked"><img src={lock} width={21} height={21} alt="" /><p>내 기억부터 남기면 열려요</p><small>친구 이야기 {photo.friends.length}개가 기다리고 있어요</small></div></>}
      </div>
    </MemoryCard>
    {error && <p role="alert" className="memory-error">{error}</p>}
    <footer className="memory-actions">
      {/* 덧붙임은 개수 제한 없이, 돌려보는 시간 안이면 몇 번이든 더 남길 수 있다 (시간이 끝나면 두루마리 답가로) */}
      {!readOnly && <Button onClick={onAdd} disabled={busy}>{response?.status === 'added' ? '더 덧붙이기' : response?.status === 'passed' ? '덧붙이기로 바꾸기' : '덧붙이기'}</Button>}
      <Button variant="outline" disabled={busy} onClick={readOnly || unlocked || passed ? onNext : onPass}>{readOnly || unlocked || passed ? (single ? '돌아가기' : '다음 사진') : busy ? '처리 중…' : '패스'}</Button>
    </footer>
  </main>
}
