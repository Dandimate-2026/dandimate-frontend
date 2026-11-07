import type { ReactNode } from 'react'
import type { RoomHome, Scroll, ScrollParagraph } from '../../api/types'
import { memoryFlowerColor } from '../../lib/flower'
import { highlightTextChanges } from '../../lib/textChanges'
import { MemoryFlower, PhotoSlot } from './components'
import { getTemplate, templateStyle, type ScrollTemplateId } from './templates'
import type { ReweaveResult } from './types'

export function ParagraphStory({ paragraph, changes }: { paragraph: ScrollParagraph; changes?: ReweaveResult }) {
  const reply = changes?.reply
  const hasReplySource = reply && paragraph.sources.some((source) => source.member.id === reply.member.id && source.quote === reply.text)
  return <>
    <p className="memory-narrative">{changes ? highlightTextChanges(changes.previous.body, paragraph.body).map((part, index) => part.changed
      ? <mark className="memory-text-highlight" key={index}>{part.text}</mark>
      : part.text) : paragraph.body}</p>
    <div className="memory-quotes">{paragraph.sources.map((source) => {
      const isReply = reply?.member.id === source.member.id && reply.text === source.quote
      return <blockquote className="memory-quote" key={source.entryId}>
        <cite><MemoryFlower color={memoryFlowerColor(source.member.flowerCode)} size={18} />{source.member.nickname}{isReply && ' · 답가'}</cite>
        <p>“{source.quote}”</p>
      </blockquote>
    })}
      {reply && !hasReplySource && <blockquote className="memory-quote">
        <cite><MemoryFlower color={memoryFlowerColor(reply.member.flowerCode)} size={18} />{reply.member.nickname} · 답가</cite>
        <p>“{reply.text}”</p>
      </blockquote>}
    </div>
  </>
}

export default function ScrollDocument({ scroll, home, template, paragraph, children }: {
  scroll: Scroll; home: RoomHome; template: ScrollTemplateId; paragraph?: ScrollParagraph; children?: ReactNode
}) {
  const selected = getTemplate(template)
  return <article className={`scroll-document scroll-design scroll-template-${template} has-template`} style={templateStyle(template)}>
    {template === 'minimal' ? <div className="scroll-rod" aria-hidden="true" /> : <img className="scroll-template-hero" src={selected.art} width={360} height={180} alt="" />}
    <div className="scroll-document-body">
      <header className="scroll-document-heading"><h1>{home.room.name}</h1><p>{home.room.meetingDate?.replaceAll('-', '.')} · 참여 {scroll.participantCount}/{scroll.memberCount} · 사진 {scroll.paragraphs.length}장</p>
        <ul className="memory-members">{home.members.map((member) => <li key={member.id}><MemoryFlower color={memoryFlowerColor(member.flowerCode)} size={25} /><span className="memory-member-name">{member.nickname}</span></li>)}</ul>
      </header>
      {(paragraph ? [paragraph] : scroll.paragraphs).map((item) => <section className="memory-chapter" key={item.id}>
        <PhotoSlot label={`${item.photo.uploader.nickname}님의 사진`} src={item.photo.imageUrl} />
        <p className="memory-chapter-meta">{item.photo.uploader.nickname}님이 올린 사진</p>
        <ParagraphStory paragraph={item} />
      </section>)}
      {template === 'minimal' && <div className="scroll-rod scroll-rod-end" aria-hidden="true" />}
      {children}
    </div>
  </article>
}
