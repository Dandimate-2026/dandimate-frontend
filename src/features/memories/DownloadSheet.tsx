import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RoomHome, Scroll } from '../../api/types'
import Button from '../../components/Button'
import { DownloadIcon } from '../../components/ShareIcons'
import { BottomSheet } from './components'
import ScrollDocument from './ScrollDocument'
import { exportScroll, type DownloadFormat, type DownloadResult } from './scrollDownload'
import type { ScrollTemplateId } from './templates'

export default function DownloadSheet({ scroll, home, template, onClose, onComplete }: {
  scroll: Scroll; home: RoomHome; template: ScrollTemplateId; onClose: () => void; onComplete: (result: DownloadResult) => void
}) {
  const [format, setFormat] = useState<DownloadFormat>('image')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const exportRef = useRef<HTMLDivElement>(null)
  async function save() {
    if (busy || !exportRef.current) return
    setBusy(true); setError('')
    try {
      const documents = [...exportRef.current.querySelectorAll<HTMLElement>('.scroll-document')]
      const result = await exportScroll(documents[0], documents.slice(1), format, home.room.name)
      onComplete(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '다운로드하지 못했어요. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return <><BottomSheet title="두루마리 저장하기" onClose={() => { if (!busy) onClose() }}>
    <p className="download-description">{home.room.name} · 문단 {scroll.paragraphs.length}개</p>
    <fieldset className="download-options" disabled={busy}><legend className="sr-only">저장 형식</legend>{([
      ['image', '↓', '긴 이미지 한 장', '두루마리 전체를 PNG로 저장해요'],
      ['cards', '1:1', `사진별 카드 ${scroll.paragraphs.length}장`, '사진별 PNG 이미지를 ZIP 파일로 저장해요'],
      ['pdf', 'PDF', 'PDF 파일', '인쇄하거나 보관하기 좋아요'],
    ] as const).map(([id, icon, title, detail]) => <label className="download-option" key={id}>
      <span className="download-option-icon" aria-hidden="true">{id === 'image' ? <DownloadIcon /> : icon}</span><span><strong>{title}</strong><small>{detail}</small></span>
      <input type="radio" name="download-format" value={id} checked={format === id} onChange={() => setFormat(id)} />
    </label>)}</fieldset>
    {error && <p className="memory-error" role="alert">{error}</p>}
    <Button className="memory-save" disabled={busy || !scroll.paragraphs.length} onClick={() => void save()}>{busy ? '파일 만드는 중…' : '저장하기'}</Button>
    <p className="download-privacy">친구 이름과 이야기가 담겨 있어요. 공유할 때 친구들과 함께 정해 주세요.</p>
  </BottomSheet>
    {createPortal(<div className="scroll-export-stage" ref={exportRef} aria-hidden="true">
      <ScrollDocument scroll={scroll} home={home} template={template} />
      {scroll.paragraphs.map((paragraph) => <ScrollDocument key={paragraph.id} scroll={scroll} home={home} template={template} paragraph={paragraph} />)}
    </div>, document.body)}
  </>
}
