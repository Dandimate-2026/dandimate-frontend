import { useEffect } from 'react'
import Button from '../../components/Button'
import Flower from '../../components/Flower'
import { MemoryCard, MemoryFlower, MemoryHeader, ShareMemoryButton } from './components'

export function CirculationComplete({ addedCount = 3, photoCount = 4, onBack, onHome, roomName }: { addedCount?: number; photoCount?: number; onBack: () => void; onHome: () => void; roomName?: string }) {
  return <main className="memory-page memory-complete">
    <MemoryHeader onBack={onBack} />
    <div className="memory-complete-main">
      <div className="memory-flower-garland" aria-hidden="true">{(['pink', 'blue', 'orange', 'orange', 'orange'] as const).map((color, i) => <MemoryFlower key={i} color={color} size={40} />)}</div>
      <h1>친구 사진을 다 봤어요</h1>
      <p>사진 {photoCount}장 중 {addedCount}장에 기억을 보탰어요<br />엮이면 단톡방으로 알려드릴게요</p>
      <div className="memory-stats"><MemoryCard><p>내가 보탠 이야기</p><strong>{addedCount}개</strong></MemoryCard><MemoryCard><p>두루마리까지</p><strong>엮기 전</strong></MemoryCard></div>
    </div>
    <footer className="memory-complete-footer"><Button onClick={onHome}>홈으로</Button><ShareMemoryButton context="circulating" roomName={roomName} /></footer>
  </main>
}

// UI 확인용 타이머. 실제 서비스에서는 서버의 엮기 완료 상태로 onReady를 호출한다.
export function WeavingPage({ onBack, onReady, durationMs = 30000, autoReady = true, title = '경주 1박2일', error, onRetry, reweavingCount, remaining, limit, photoCount, participantDetail }: { onBack: () => void; onReady: () => void; durationMs?: number; autoReady?: boolean; title?: string; error?: string; onRetry?: () => void; reweavingCount?: number; remaining?: number; limit?: number; photoCount?: number; participantDetail?: string }) {
  useEffect(() => { if (!autoReady) return; const timer = window.setTimeout(onReady, durationMs); return () => window.clearTimeout(timer) }, [autoReady, durationMs, onReady])
  return <main className={`memory-page memory-weaving ${reweavingCount ? 'memory-reweaving' : ''}`}>
    <MemoryHeader title={title} onBack={onBack} />
    <div className="memory-weaving-main" role="status" aria-live="polite">
      <div className="weave-anim" role="img" aria-label="두루마리를 엮는 중">
        <span className="weave-rod weave-rod-top" />
        <span className="weave-paper"><span className="weave-flower"><Flower code="AZALEA" size={44} /></span></span>
        <span className="weave-rod weave-rod-bottom" />
      </div>
      <h1>{error ? '두루마리를 엮지 못했어요' : reweavingCount ? `이야기 ${reweavingCount}개를 다시 엮고 있어요` : '이야기를 엮고 있어요'}</h1>
      <p>{error || (reweavingCount ? <>아까는 잘 안 엮였어요.<br />한 번 더 꼼꼼하게 엮어 볼게요</> : <>서로 다른 기억이 모여<br />하나의 두루마리가 되고 있어요</>)}</p>
      <div className="memory-loading" aria-hidden="true"><span /><span /><span /></div>
      {error && onRetry && <Button onClick={onRetry}>다시 엮기</Button>}
    </div>
    <footer className="memory-weaving-footer">{reweavingCount ? <p>
      {photoCount !== undefined && <>사진 {photoCount}장 · </>}{participantDetail && <>참여 {participantDetail} · </>}
      {remaining !== undefined && <strong>재엮기 {remaining}{limit !== undefined ? `/${limit}` : ''}회 남음 · </strong>}완료되면 두루마리가 열려요
    </p> : <><p>완료되면 두루마리가 열려요</p><ShareMemoryButton context="weaving" roomName={title} label="기다리는 동안 단톡방에 알리기" /></>}</footer>
  </main>
}
