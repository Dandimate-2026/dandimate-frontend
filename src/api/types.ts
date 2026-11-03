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

export interface CreateRoomRequest {
  name: string
  meetingDate: string
  hostNickname: string
  consent: Consent
}

export interface CreateRoomResult {
  room: RoomSummary
  member: Member
  /** 원본 초대 토큰. 이 응답에서 한 번만 받는다 */
  inviteToken: string
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

export interface CloseRoomResult {
  roomStatus: RoomStatus
  job: { id: string; type: 'WEAVE_SCROLL'; status: string }
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

export interface Photo {
  id: string
  imageUrl: string
  uploader: Member
  displayOrder: number
}

export interface Entry {
  id: string
  photoId: string
  member: Member
  kind: EntryKind | 'ASKBACK_ANSWER'
  inputMode: 'VOICE' | 'TEXT'
  transcript: string
  audioUrl?: string | null
  confirmedAt: string
}

export type AskbackStatus = 'PENDING' | 'ANSWERED' | 'FORGOT' | 'EXPIRED' | 'CANCELLED'

export interface Askback {
  id: string
  photo: Photo
  gapType: 'CONFLICT' | 'MISSING_REASON' | 'NO_ADDON' | 'MISSING_CONTEXT'
  question: string
  /** 질문의 근거가 된 이야기를 쓴 친구들 */
  evidenceNicknames: string[]
  status: AskbackStatus
  firstEntry?: Entry | null
  createdAt: string
  expiresAt: string
}

export type AskbackAnswerRequest =
  | { inputMode: 'VOICE'; transcriptionId: string; transcript: string }
  | { inputMode: 'TEXT'; transcript: string }

export type CreateEntryRequest =
  | { kind: EntryKind; inputMode: 'VOICE'; transcriptionId: string; transcript: string }
  | { kind: EntryKind; inputMode: 'TEXT'; transcript: string }

export interface CirculationCard {
  photo: Photo
  firstEntry: Entry | null
  myResponse: { status: 'NONE' | 'ADDON' | 'PASSED' | 'OWN_PHOTO' }
  locked: boolean
  lockReason?: 'RESPOND_FIRST' | null
  otherEntries: Entry[]
}

export interface CirculationResponse {
  cards: CirculationCard[]
  nextCursor?: string | null
}

export interface ScrollParagraph {
  id: string
  photo: Photo
  body: string
  version: number
  sources: { entryId: string; member: Member; quote: string }[]
  replyCount: number
  ahMatdaCount: number
  aiGenerated: true
}

export interface Scroll {
  id: string
  version: number
  participantCount: number
  memberCount: number
  generatedAt?: string
  paragraphs: ScrollParagraph[]
}

export interface Job {
  id: string
  type: 'ASKBACK_ANALYZE' | 'WEAVE_SCROLL' | 'REPLY_REWEAVE' | 'MEDIA_DELETE'
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  progress?: { completed: number; total: number }
  errorCode?: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationType = 'ASKBACK_RECEIVED' | 'SCROLL_READY' | 'REPLY_APPLIED'

export interface RoomNotification {
  id: string
  type: NotificationType
  resourceType: string
  resourceId: string
  readAt?: string | null
  createdAt: string
}

export interface EventToken {
  eventsUrl: string
  expiresAt: string
}
