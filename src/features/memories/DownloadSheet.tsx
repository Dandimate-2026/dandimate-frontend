import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RoomHome, Scroll } from '../../api/types'
import Button from '../../components/Button'
import { DownloadIcon } from '../../components/ShareIcons'
import { BottomSheet } from './components'
import ScrollDocument from './ScrollDocument'
import { downloadBlob, exportScroll, saveDownload, type DownloadFile, type DownloadFormat, type DownloadResult } from './scrollDownload'
import type { ScrollTemplateId } from './templates'

export default function DownloadSheet({ scroll, home, template, onClose, onComplete }: {
  scroll: Scroll; home: RoomHome; template: ScrollTemplateId; onClose: () => void; onComplete: (result: DownloadResult) => void
}) {
  const [format, setFormat] = useState<DownloadFormat>('image')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DownloadResult | null>(null)
  const [message, setMessage] = useState('')
  const saving = useRef(false)
  const exportRef = useRef<HTMLDivElement>(null)
  async function save() {
    if (busy || !exportRef.current) return
    setBusy(true); setError('')
    try {
      const documents = [...exportRef.current.querySelectorAll<HTMLElement>('.scroll-document')]
      const result = await exportScroll(documents[0], documents.slice(1), format, home.room.name)
      setResult(result)
      onComplete(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '다운로드하지 못했어요. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  async function deliver(file: DownloadFile) {
    if (saving.current) return
    saving.current = true
    setError(''); setMessage('')
    try {
      const method = await saveDownload(file)
      setMessage(method === 'shared' ? '공유창에서 선택한 위치를 확인해 주세요.' : '다운로드를 시작했어요. 다운로드 폴더를 확인해 주세요.')
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('저장창을 열지 못했어요. 파일 다운로드를 누르거나 외부 브라우저에서 다시 열어 주세요.')
    } finally { saving.current = false }
  }
  return <><BottomSheet title="두루마리 저장하기" onClose={() => { if (!busy) onClose() }}>
    <p className="download-description">{home.room.name} · 문단 {scroll.paragraphs.length}개</p>
    <fieldset className="download-options" disabled={busy}><legend className="sr-only">저장 형식</legend>{([
      ['image', '↓', '긴 이미지 한 장', '두루마리 전체를 PNG로 저장해요'],
      ['cards', '1:1', `사진별 카드 ${scroll.paragraphs.length}장`, '사진마다 PNG로 저장하거나 ZIP으로 모아 받아요'],
      ['pdf', 'PDF', 'PDF 파일', '인쇄하거나 보관하기 좋아요'],
    ] as const).map(([id, icon, title, detail]) => <label className="download-option" key={id}>
      <span className="download-option-icon" aria-hidden="true">{id === 'image' ? <DownloadIcon /> : icon}</span><span><strong>{title}</strong><small>{detail}</small></span>
      <input type="radio" name="download-format" value={id} checked={format === id} onChange={() => { setFormat(id); setResult(null); setError(''); setMessage('') }} />
    </label>)}</fieldset>
    {error && <p className="memory-error" role="alert">{error}</p>}
    {!result && <Button className="memory-save" disabled={busy || !scroll.paragraphs.length} onClick={() => void save()}>{busy ? '파일 만드는 중…' : '저장 파일 준비하기'}</Button>}
    {result && <section className="download-ready" aria-label="준비된 파일">
      <p role="status">파일을 준비했어요. 아래 버튼을 눌러 저장해 주세요.</p>
      {result.files ? <>
        {result.files.map((file, index) => <Button key={file.name} variant="outline" onClick={() => void deliver(file)}>사진 {index + 1} PNG 저장</Button>)}
        <button type="button" className="memory-text-link" onClick={() => downloadBlob(result.blob, result.name)}>전체 ZIP 다운로드</button>
        <p className="memory-sheet-hint">ZIP은 압축 파일이에요. 휴대폰에서는 위의 PNG 저장 버튼을 이용해 주세요.</p>
      </> : <>
        <Button onClick={() => void deliver(result)}>{format === 'pdf' ? 'PDF 저장' : '이미지 저장'}</Button>
        <button type="button" className="memory-text-link" onClick={() => downloadBlob(result.blob, result.name)}>파일 다운로드</button>
      </>}
      <p className="memory-sheet-hint">iPhone에서는 공유창의 ‘이미지 저장’ 또는 ‘파일에 저장’을 선택해 주세요. 카카오톡 안에서 저장이 안 되면 Safari나 Chrome에서 열어 주세요.</p>
    </section>}
    {message && <p role="status" className="memory-sheet-hint">{message}</p>}
    <p className="download-privacy">친구 이름과 이야기가 담겨 있어요. 공유할 때 친구들과 함께 정해 주세요.</p>
  </BottomSheet>
    {createPortal(<div className="scroll-export-stage" ref={exportRef} aria-hidden="true">
      <ScrollDocument scroll={scroll} home={home} template={template} />
      {scroll.paragraphs.map((paragraph) => <ScrollDocument key={paragraph.id} scroll={scroll} home={home} template={template} paragraph={paragraph} />)}
    </div>, document.body)}
  </>
}
