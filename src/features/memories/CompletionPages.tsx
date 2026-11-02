import { useEffect } from 'react'
import Button from '../../components/Button'
import scrollFlower from '../../assets/memories/scroll-flower.svg'
import { MemoryCard, MemoryFlower, MemoryHeader, ShareMemoryButton } from './components'

export function CirculationComplete({ addedCount = 3, photoCount = 4, onBack, onHome }: { addedCount?: number; photoCount?: number; onBack: () => void; onHome: () => void }) {
  return <main className="memory-page memory-complete">
    <MemoryHeader onBack={onBack} />
    <div className="memory-complete-main">
      <div className="memory-flower-garland" aria-hidden="true">{(['pink', 'blue', 'orange', 'orange', 'orange'] as const).map((color, i) => <MemoryFlower key={i} color={color} size={40} />)}</div>
      <h1>친구 사진을 다 봤어요</h1>
      <p>사진 {photoCount}장 중 {addedCount}장에 기억을 보탰어요<br />엮이면 단톡방으로 알려드릴게요</p>
      <div className="memory-stats"><MemoryCard><p>내가 보탠 이야기</p><strong>{addedCount}개</strong></MemoryCard><MemoryCard><p>두루마리까지</p><strong>31시간</strong></MemoryCard></div>
    </div>
    <footer className="memory-complete-footer"><Button onClick={onHome}>홈으로</Button><ShareMemoryButton /></footer>
  </main>
}

// UI 확인용 타이머. 실제 서비스에서는 서버의 엮기 완료 상태로 onReady를 호출한다.
export function WeavingPage({ onBack, onReady, durationMs = 30000 }: { onBack: () => void; onReady: () => void; durationMs?: number }) {
  useEffect(() => { const timer = window.setTimeout(onReady, durationMs); return () => window.clearTimeout(timer) }, [durationMs, onReady])
  return <main className="memory-page memory-weaving">
    <MemoryHeader title="경주 1박2일" onBack={onBack} />
    <div className="memory-weaving-main" role="status" aria-live="polite">
      <img className="memory-scroll-flower" src={scrollFlower} width={97} height={116} alt="꽃이 담긴 두루마리" />
      <h1>이야기 6개를 엮고 있어요</h1>
      <p>서로 다른 기억이 모여<br />하나의 두루마리가 되고 있어요</p>
      <div className="memory-loading" aria-hidden="true"><span /><span /><span /></div>
    </div>
    <footer className="memory-weaving-footer"><p>사진 6장 · 참여 3/3 · 보통 30초쯤 걸려요</p><ShareMemoryButton label="기다리는 동안 단톡방에 알리기" /></footer>
  </main>
}
