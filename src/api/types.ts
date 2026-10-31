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

export type PhotoContentType = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif'

export interface UploadFileRequest {
  clientFileId: string
  fileName: string
  contentType: PhotoContentType
  sizeBytes: number
  displayOrder: number
}

export interface UploadTicket {
  clientFileId: string
  photoId: string
  uploadUrl: string
  expiresAt: string
  requiredHeaders?: Record<string, string>
}

export type EntryKind = 'FIRST' | 'ADDON'

export interface TranscriptionDraft {
  transcriptionId: string
  audioAssetId: string
  transcript: string
  expiresAt: string
}

export type CreateEntryRequest =
  | { kind: EntryKind; inputMode: 'VOICE'; transcriptionId: string; transcript: string }
  | { kind: EntryKind; inputMode: 'TEXT'; transcript: string }
