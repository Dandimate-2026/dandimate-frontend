import type { Member, ScrollParagraph } from '../../api/types'

export interface ReweaveResult {
  paragraphId: string
  version: number
  previous: ScrollParagraph
  reply: { member: Member; text: string }
}

export type FlowerColor = 'pink' | 'blue' | 'orange'
export type PreviewScreen = 'screens' | 's6-1' | 's6-2' | 's6-3' | 's6-4' | 's6-5' | 's8' | 's9' | 's10'

export interface MemoryContribution {
  text: string
  audioUrl?: string
  audioBlob?: Blob
  transcriptionId?: string
  durationMs?: number
}

export interface MemoryStory extends MemoryContribution {
  /** 서버 이야기 id (고치기·지우기에 쓴다) */
  id?: string
  /** 내가 남긴 이야기라 고치거나 지울 수 있는지 */
  mine?: boolean
  author: string
  flower?: FlowerColor
  kind: string
  durationLabel?: string
}

export interface MemoryPhoto {
  id: string
  owner: string
  flower: FlowerColor
  location: string
  dateLabel: string
  photoUrl?: string
  /** 내가 올린 사진이라 지울 수 있는지 */
  mine?: boolean
  firstStory: MemoryStory
  friends: MemoryStory[]
}

export interface MemoryResponse {
  status: 'added' | 'passed'
  contribution?: MemoryContribution
}
