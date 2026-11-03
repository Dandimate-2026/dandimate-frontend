// 백엔드가 준비되기 전, 개발 서버에서 화면을 확인하기 위한 예시 데이터
// .env.local 에 VITE_USE_MOCK=false 를 넣으면 실제 API를 호출한다
import type {
  Askback,
  CloseRoomResult,
  CreateRoomRequest,
  CreateRoomResult,
  InvitePreview,
  JoinRoomResult,
  Member,
  RoomHome,
  RoomNotification,
  TranscriptionDraft,
} from './types'

export const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'

export const MOCK_ROOM_ID = 'demo'
/** 방 만들기로 막 연 방. 친구를 기다리는 화면을 확인할 때 쓴다 */
export const MOCK_NEW_ROOM_ID = 'gathering'
/** 두루마리가 완성된 방. 방 목록의 완성된 두루마리를 확인할 때 쓴다 */
export const MOCK_DONE_ROOM_ID = 'done'
export const MOCK_ROOM_IDS = [MOCK_ROOM_ID, MOCK_NEW_ROOM_ID, MOCK_DONE_ROOM_ID]
/** 모두 다 봐서 엮을 수 있는 방. 방 목록에는 넣지 않고 주소로만 확인한다 */
export const MOCK_READY_ROOM_ID = 'ready'
export const MOCK_INVITE_TOKEN = 'demo'

export const mockInvitePreview: InvitePreview = {
  roomName: '경주 1박2일',
  meetingDate: '2026-10-17',
  status: 'COLLECTING',
  memberCount: 3,
  capacity: 8,
  flowers: ['AZALEA', 'FORGET_ME_NOT', 'FORSYTHIA'],
  canJoin: true,
}

export function mockCreateRoom({ name, meetingDate, hostNickname }: CreateRoomRequest): CreateRoomResult {
  return {
    room: {
      id: MOCK_NEW_ROOM_ID,
      name,
      meetingDate,
      status: 'COLLECTING',
      deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    },
    member: { id: 'mock-host', nickname: hostNickname, role: 'HOST', flowerCode: 'AZALEA' },
    inviteToken: MOCK_INVITE_TOKEN,
  }
}

export function mockJoinRoom(nickname: string): JoinRoomResult {
  return {
    room: {
      id: MOCK_ROOM_ID,
      name: mockInvitePreview.roomName,
      meetingDate: mockInvitePreview.meetingDate,
      status: 'COLLECTING',
      deadlineAt: '2026-10-19T00:00:00+09:00',
    },
    member: { id: 'mock-member', nickname, role: 'MEMBER', flowerCode: 'LILAC' },
  }
}

const mockMembers: RoomHome['members'] = [
  { id: 'm1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', photoCount: 2, storyCount: 3, responseRate: 1 },
  { id: 'm2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', photoCount: 2, storyCount: 1, responseRate: 0.55 },
  { id: 'm3', nickname: '지수', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', photoCount: 3, storyCount: 2, responseRate: 0.75 },
]

export const mockRoomHome: RoomHome = {
  room: {
    id: MOCK_ROOM_ID,
    name: mockInvitePreview.roomName,
    meetingDate: mockInvitePreview.meetingDate,
    status: 'CIRCULATING',
    // 지금부터 31시간 뒤
    deadlineAt: new Date(Date.now() + 31 * 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[1],
  members: mockMembers,
  todayFlowers: [
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'FIRST' },
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'ADDON' },
    { memberId: 'm2', flowerCode: 'FORSYTHIA', entryKind: 'FIRST' },
    { memberId: 'm3', flowerCode: 'FORGET_ME_NOT', entryKind: 'FIRST' },
    { memberId: 'm3', flowerCode: 'FORGET_ME_NOT', entryKind: 'ADDON' },
    { memberId: 'm1', flowerCode: 'AZALEA', entryKind: 'ADDON' },
  ],
  myTodo: {
    needsFirstEntry: false,
    pendingCirculationCount: 3,
    topAskback: { id: 'a1', question: '민지님은 그때 어땠어요?' },
  },
  unreadCount: 0,
  allCompleted: false,
}

/** 모두 다 봐서 방장이 엮을 수 있는 방 */
export const mockReadyRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_READY_ROOM_ID,
    // 지금부터 12시간 뒤
    deadlineAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[0],
  members: mockMembers.map((m) => ({ ...m, responseRate: 1 })),
  myTodo: { needsFirstEntry: false, pendingCirculationCount: 0, topAskback: null },
  allCompleted: true,
}

export function mockCloseRoom(): CloseRoomResult {
  return { roomStatus: 'WEAVING', job: { id: 'mock-job', type: 'WEAVE_SCROLL', status: 'QUEUED' } }
}

const mockHost: Member = { id: 'mock-host', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA' }

/** 방장 혼자 있는 막 만든 방 */
export const mockNewRoomHome: RoomHome = {
  room: {
    id: MOCK_NEW_ROOM_ID,
    name: '가을 MT',
    meetingDate: '2026-11-01',
    status: 'COLLECTING',
    // 지금부터 47시간 뒤
    deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
  },
  me: mockHost,
  members: [mockHost],
  todayFlowers: [],
  myTodo: { needsFirstEntry: true, pendingCirculationCount: 0, topAskback: null },
  unreadCount: 0,
  allCompleted: false,
}

const mockDoneMembers: RoomHome['members'] = [
  { id: 'd1', nickname: '서연', role: 'HOST', flowerCode: 'AZALEA', photoCount: 3 },
  { id: 'd2', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA', photoCount: 2 },
  { id: 'd3', nickname: '지수', role: 'MEMBER', flowerCode: 'FORGET_ME_NOT', photoCount: 2 },
  { id: 'd4', nickname: '하린', role: 'MEMBER', flowerCode: 'LILAC', photoCount: 2 },
]

/** 두루마리가 완성되어 답가를 받는 방 */
export const mockDoneRoomHome: RoomHome = {
  room: {
    id: MOCK_DONE_ROOM_ID,
    name: '여름 부산 바다',
    meetingDate: '2026-08-14',
    status: 'GROWING',
    deadlineAt: '2026-08-16T00:00:00+09:00',
  },
  me: mockDoneMembers[0],
  members: mockDoneMembers,
  todayFlowers: [],
  myTodo: { needsFirstEntry: false, pendingCirculationCount: 0, topAskback: null },
  unreadCount: 2,
  allCompleted: true,
}

export const mockAskback: Askback = {
  id: 'a1',
  // 사진이 없으면 화면에서 자리표시를 보여준다
  photo: { id: 'mock-photo', imageUrl: '', uploader: mockMembers[0], displayOrder: 0 },
  gapType: 'CONFLICT',
  question: '민지님은 그때 어땠어요?',
  evidenceNicknames: ['서연', '지수'],
  status: 'PENDING',
  firstEntry: null,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
}

/** 받아 적기 흉내. 1.2초 뒤 정해진 글을 돌려준다 */
export function mockTranscribe(transcript: string) {
  return new Promise<TranscriptionDraft>((resolve) =>
    setTimeout(
      () =>
        resolve({
          transcriptionId: 'mock-transcription',
          audioAssetId: 'mock-audio',
          transcript,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      1200,
    ),
  )
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString()

export const mockNotifications: RoomNotification[] = [
  { id: 'n1', type: 'ASKBACK_RECEIVED', resourceType: 'ASKBACK', resourceId: 'a1', readAt: null, createdAt: minutesAgo(5) },
  { id: 'n2', type: 'REPLY_APPLIED', resourceType: 'SCROLL', resourceId: 's1', readAt: null, createdAt: minutesAgo(180) },
  { id: 'n3', type: 'SCROLL_READY', resourceType: 'SCROLL', resourceId: 's1', readAt: minutesAgo(1440), createdAt: minutesAgo(1500) },
]
