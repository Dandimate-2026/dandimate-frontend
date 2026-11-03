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
  /** 방장을 포함한 정원 (1~8) */
  capacity?: number
  planType?: RoomPlanType
  /** 플랜별 한도와 사용량. 모임방 홈 조회에만 들어 있다 */
  quota?: RoomQuota
}

/** 플랜별 한도와 지금까지 쓴 양 */
export interface RoomQuota {
  photosPerMember?: number
  myPhotoCount?: number
  myPhotosRemaining?: number
  photosRemaining?: number
  voiceLimitMs?: number
  voiceUsedMs?: number
  voiceRemainingMs?: number
  regenerationLimit?: number
  regenerationCount?: number
  regenerationsRemaining?: number
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
}

export type RoomPlanType = 'FREE' | 'LITE' | 'PRO'

export interface CreateRoomRequest {
  name: string
  meetingDate: string
  hostNickname: string
  /** 방별 플랜. LITE·PRO는 서버 결제 검증이 붙기 전까지 503 PAYMENT_NOT_CONFIGURED */
  planType: RoomPlanType
  /** 방장을 포함한 정원 (1~8, 생략하면 8) */
  capacity?: number
  consent: Consent
}

export interface CreateRoomResult {
  room: RoomSummary
  member: Member
  /** 원본 초대 토큰. 이 응답에서 한 번만 받는다 */
  inviteToken: string
}

/** GET /users/me/rooms: 로그인한 계정이 참여 중인 방 */
export interface MyRoom {
  roomId: string
  name: string
  status: RoomStatus
  memberId: string
  nickname: string
  role: 'HOST' | 'MEMBER'
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

// PLAN_UPGRADE_REQUESTED: 멤버가 방장에게 플랜을 바꿔 달라고 요청함 (TODO: 백엔드 미지원, 가정한 값)
export type NotificationType = 'ASKBACK_RECEIVED' | 'SCROLL_READY' | 'REPLY_APPLIED' | 'PLAN_UPGRADE_REQUESTED'

/** 어떤 한도 때문에 플랜 변경을 요청했는지 */
export type PlanRequestReason = 'PHOTO' | 'VOICE' | 'REWEAVE'

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
