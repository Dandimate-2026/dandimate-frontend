import type { ReactNode } from 'react'
import type { RoomHome, Scroll, ScrollParagraph } from '../../api/types'
import { memoryFlowerColor } from '../../lib/flower'
import { MemoryFlower, PhotoSlot } from './components'
import { getTemplate, templateStyle, type ScrollTemplateId } from './templates'

export function ParagraphStory({ paragraph }: { paragraph: ScrollParagraph }) {
  return <>
    <p className="memory-narrative">{paragraph.body}</p>
    <div className="memory-quotes">{paragraph.sources.map((source) => <blockquote className="memory-quote" key={source.entryId}>
      <cite><MemoryFlower color={memoryFlowerColor(source.member.flowerCode)} size={18} />{source.member.nickname}</cite>
      <p>“{source.quote}”</p>
    </blockquote>)}</div>
  </>
}

export default function ScrollDocument({ scroll, home, template, paragraph, children }: {
  scroll: Scroll; home: RoomHome; template: ScrollTemplateId; paragraph?: ScrollParagraph; children?: ReactNode
}) {
  const selected = getTemplate(template)
  return <article className={`scroll-document ${template !== 'minimal' ? 'has-template' : ''}`} style={templateStyle(template)}>
    <img className="scroll-template-hero" src={selected.art} width={360} height={180} alt="" />
    <div className="scroll-document-body">
      <header className="scroll-document-heading"><h1>{home.room.name}</h1><p>{home.room.meetingDate?.replaceAll('-', '.')} · 참여 {scroll.participantCount}/{scroll.memberCount} · 사진 {scroll.paragraphs.length}장</p>
        <ul className="memory-members">{home.members.map((member) => <li key={member.id}><MemoryFlower color={memoryFlowerColor(member.flowerCode)} size={25} />{member.nickname}</li>)}</ul>
      </header>
      {(paragraph ? [paragraph] : scroll.paragraphs).map((item) => <section className="memory-chapter" key={item.id}>
        <PhotoSlot label={`${item.photo.uploader.nickname}님의 사진`} src={item.photo.imageUrl} />
        <p className="memory-chapter-meta">{item.photo.uploader.nickname}님이 올린 사진</p>
        <ParagraphStory paragraph={item} />
      </section>)}
      {children}
    </div>
  </article>
}
