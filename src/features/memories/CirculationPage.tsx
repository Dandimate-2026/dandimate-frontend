import Button from '../../components/Button'
import lock from '../../assets/memories/lock.svg'
import skip from '../../assets/memories/skip.svg'
import { MemoryCard, MemoryFlower, MemoryHeader, PhotoSlot, StoryCard, TextModeToggle } from './components'
import type { MemoryPhoto, MemoryResponse } from './types'

export default function CirculationPage({ photo, position, total, response, textOnly, onTextMode, onBack, onAdd, onPass, onNext }: {
  photo: MemoryPhoto
  position: number
  total: number
  response?: MemoryResponse
  textOnly: boolean
  onTextMode: (value: boolean) => void
  onBack: () => void
  onAdd: () => void
  onPass: () => void
  onNext: () => void
}) {
  const unlocked = Boolean(response)
  return <main className="memory-page memory-circulation">
    <MemoryHeader progress={`${position} / ${total}`} onBack={onBack} />
    <TextModeToggle value={textOnly} onChange={onTextMode} />
    <MemoryCard className="memory-photo-card">
      <div className="memory-photo-owner"><span><MemoryFlower color={photo.flower} />{photo.owner} 님이 올렸어요</span><small>이야기 {1 + photo.friends.length}개</small></div>
      <PhotoSlot label={photo.location} date={photo.dateLabel} src={photo.photoUrl} icon />
      <div className="memory-stories" key={`${photo.id}-${textOnly}`}>
        <StoryCard story={photo.firstStory} textOnly={textOnly} />
        {unlocked ? <>
          {photo.friends.map((story) => <StoryCard key={story.author} story={story} textOnly={textOnly} />)}
          {response?.status === 'added' && response.contribution && <StoryCard mine textOnly={textOnly} story={{ ...response.contribution, author: '민지', flower: 'orange', kind: response.contribution.audioUrl ? '말로 남김' : '글로 남김' }} />}
          {response?.status === 'passed' && <p className="memory-passed"><img src={skip} width={14} height={14} alt="" />이 사진은 패스했어요</p>}
        </> : <div className="memory-locked"><img src={lock} width={21} height={21} alt="" /><p>내 기억부터 남기면 열려요</p><small>친구 이야기 {photo.friends.length}개가 기다리고 있어요</small></div>}
      </div>
    </MemoryCard>
    <footer className="memory-actions">
      <Button onClick={onAdd}>{response?.status === 'added' ? '덧붙임 수정' : response?.status === 'passed' ? '덧붙이기로 바꾸기' : '덧붙이기'}</Button>
      <Button variant="outline" onClick={unlocked ? onNext : onPass}>{unlocked ? '다음 사진' : '패스'}</Button>
    </footer>
  </main>
}
