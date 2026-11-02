export type FlowerColor = 'pink' | 'blue' | 'orange'
export type PreviewScreen = 'screens' | 's6-1' | 's6-2' | 's6-3' | 's6-4' | 's6-5' | 's8' | 's9' | 's10'

export interface MemoryContribution {
  text: string
  audioUrl?: string
  durationMs?: number
}

export interface MemoryStory extends MemoryContribution {
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
  firstStory: MemoryStory
  friends: MemoryStory[]
}

export interface MemoryResponse {
  status: 'added' | 'passed'
  contribution?: MemoryContribution
}
