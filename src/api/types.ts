// openapi.yaml (Duruduru Public API 0.1.0) 기준 타입

export type RoomStatus = 'COLLECTING' | 'CIRCULATING' | 'WEAVING' | 'GROWING'

export type FlowerCode =
  | 'AZALEA'
  | 'FORSYTHIA'
  | 'ROYAL_AZALEA'
  | 'CANOLA'
  | 'LILAC'
  | 'FORGET_ME_NOT'
  | 'TEAL'
  | 'PURPLE'

export interface Consent {
  version: string
  terms: true
  mediaProcessing: true
  externalAiProcessing: true
}

export interface Member {
  id: string
  nickname: string
  role: 'HOST' | 'MEMBER'
  flowerCode: FlowerCode
  photoCount?: number
  storyCount?: number
  /** 0~1, 참여현황 막대 길이 */
  responseRate?: number
}

export interface RoomSummary {
  id: string
  name: string
  meetingDate?: string
  status: RoomStatus
  deadlineAt: string
}

export interface InvitePreview {
  roomName: string
  meetingDate?: string
  status: RoomStatus
  memberCount: number
  capacity: number
  flowers: FlowerCode[]
  canJoin: boolean
}

export interface JoinRoomResult {
  room: RoomSummary
  member: Member
  memberAccessToken: string
}

export interface RoomHome {
  room: RoomSummary
  me: Member
  members: Member[]
  todayFlowers: { memberId: string; flowerCode: FlowerCode; entryKind: 'FIRST' | 'ADDON' }[]
  myTodo: {
    needsFirstEntry: boolean
    pendingCirculationCount: number
    topAskback: { id: string; question: string } | null
  }
  unreadCount: number
  allCompleted: boolean
}

export interface ErrorBody {
  error: { code: string; message: string; requestId: string }
}
