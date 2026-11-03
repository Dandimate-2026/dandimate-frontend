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
export const MOCK_DONE_ROOM_ID = 'grown'
/** 모두 다 봐서 엮을 수 있는 방 ('엮으러 가기' 시안 화면) */
export const MOCK_READY_ROOM_ID = 'done'
/** 약속한 시간이 다 됐는데 아직 엮지 않은 방 */
export const MOCK_TIMEUP_ROOM_ID = 'timeup'
/** 플랜 한도를 모두 쓴 방 */
export const MOCK_LIMIT_ROOM_ID = 'limit'
export const MOCK_ROOM_IDS = [
  MOCK_ROOM_ID,
  MOCK_READY_ROOM_ID,
  MOCK_TIMEUP_ROOM_ID,
  MOCK_LIMIT_ROOM_ID,
  MOCK_NEW_ROOM_ID,
  MOCK_DONE_ROOM_ID,
]
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
    capacity: 5,
    planType: 'FREE',
    // Free 플랜. 사진·녹음을 평소처럼 해 볼 수 있게 한도가 남아 있는 상태로 둔다
    quota: {
      photosPerMember: 3,
      myPhotoCount: 0,
      myPhotosRemaining: 3,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 3 * 60 * 1000,
      voiceRemainingMs: 12 * 60 * 1000,
      regenerationLimit: 3,
      regenerationCount: 1,
      regenerationsRemaining: 2,
    },
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

/** 약속한 시간이 지났는데 아직 엮지 않은 방 (방장 시점) */
export const mockTimeUpRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_TIMEUP_ROOM_ID,
    name: '제주 2박3일',
    // 1시간 전에 마감
    deadlineAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  me: mockMembers[0],
}

/** 사진·말하기·재엮기 한도를 모두 쓴 방 (멤버 시점). 한도 시트를 확인할 때 쓴다 */
export const mockLimitRoomHome: RoomHome = {
  ...mockRoomHome,
  room: {
    ...mockRoomHome.room,
    id: MOCK_LIMIT_ROOM_ID,
    name: '부산 당일치기',
    quota: {
      photosPerMember: 3,
      myPhotoCount: 3,
      myPhotosRemaining: 0,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 15 * 60 * 1000,
      voiceRemainingMs: 0,
      regenerationLimit: 3,
      regenerationCount: 3,
      regenerationsRemaining: 0,
    },
  },
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
    planType: 'FREE',
    // 막 만든 Free 방이라 한도를 하나도 쓰지 않았다
    quota: {
      photosPerMember: 3,
      myPhotoCount: 0,
      myPhotosRemaining: 3,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 0,
      voiceRemainingMs: 15 * 60 * 1000,
      regenerationLimit: 3,
      regenerationCount: 0,
      regenerationsRemaining: 3,
    },
  },
  me: mockHost,
  // 멤버로 데모할 때 볼 수 있게 친구 한 명이 먼저 들어와 있다
  members: [mockHost, { id: 'mock-member-1', nickname: '민지', role: 'MEMBER', flowerCode: 'FORSYTHIA' }],
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
    planType: 'FREE',
    // 재엮기를 모두 써서 답가를 달면 한도 시트가 뜨는 상태
    quota: {
      regenerationLimit: 3,
      regenerationCount: 3,
      regenerationsRemaining: 0,
      firstMaxSeconds: 30,
      otherMaxSeconds: 20,
      voiceLimitMs: 15 * 60 * 1000,
      voiceUsedMs: 15 * 60 * 1000,
      voiceRemainingMs: 0,
    },
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
  { id: 'n0', type: 'PLAN_UPGRADE_REQUESTED', resourceType: 'PHOTO', resourceId: 'm2', readAt: null, createdAt: minutesAgo(2) },
  { id: 'n1', type: 'ASKBACK_RECEIVED', resourceType: 'ASKBACK', resourceId: 'a1', readAt: null, createdAt: minutesAgo(5) },
  { id: 'n2', type: 'REPLY_APPLIED', resourceType: 'SCROLL', resourceId: 's1', readAt: null, createdAt: minutesAgo(180) },
  { id: 'n3', type: 'SCROLL_READY', resourceType: 'SCROLL', resourceId: 's1', readAt: minutesAgo(1440), createdAt: minutesAgo(1500) },
]

// 데모 로그인에서 고른 역할 (방장으로 보기 / 멤버로 보기). lib/auth가 로그인할 때 저장한다
export type MockRole = 'HOST' | 'MEMBER'
export const MOCK_AUTH_KEY = 'duruduru:auth'

export function getMockRole(): MockRole {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_KEY)
    return raw && (JSON.parse(raw) as { role?: MockRole }).role === 'MEMBER' ? 'MEMBER' : 'HOST'
  } catch {
    return 'HOST'
  }
}

/** 데모에서 고른 역할에 맞춰 이 방의 '나'를 방장 또는 멤버로 바꿔 돌려준다 */
export function asMockRole(home: RoomHome): RoomHome {
  const role = getMockRole()
  if (home.me.role === role) return home
  const me = home.members.find((m) => m.role === role)
  return me ? { ...home, me } : home
}

// 데모에서 이 기기로 올린 사진·남긴 한마디를 기억해 두고 모임방 홈에 반영한다 (꽃이 피고 할 일이 바뀌게)
const MOCK_ACTIVITY_KEY = 'duruduru:mock-activity'

interface MockActivity {
  /** 방별로 올린 사진 수와 남긴 한마디 수 */
  rooms: Record<string, { photos: number; entries: number }>
  /** mock 사진 id가 어느 방 사진인지 */
  photoRoom: Record<string, string>
}

function readMockActivity(): MockActivity {
  try {
    const raw = sessionStorage.getItem(MOCK_ACTIVITY_KEY)
    if (raw) return JSON.parse(raw) as MockActivity
  } catch {
    // 저장소를 쓸 수 없으면 기록 없이 보여준다
  }
  return { rooms: {}, photoRoom: {} }
}

function writeMockActivity(activity: MockActivity) {
  try {
    sessionStorage.setItem(MOCK_ACTIVITY_KEY, JSON.stringify(activity))
  } catch {
    // 무시
  }
}

export function recordMockPhotos(roomId: string, photoIds: string[]) {
  const activity = readMockActivity()
  const room = activity.rooms[roomId] ?? { photos: 0, entries: 0 }
  activity.rooms[roomId] = { ...room, photos: room.photos + photoIds.length }
  photoIds.forEach((id) => (activity.photoRoom[id] = roomId))
  writeMockActivity(activity)
}

/** 첫 한마디를 남긴 사진. 그 사진이 올라간 방에 꽃이 하나 핀다 */
export function recordMockEntry(photoId: string) {
  const activity = readMockActivity()
  const roomId = activity.photoRoom[photoId]
  if (!roomId) return
  const room = activity.rooms[roomId] ?? { photos: 0, entries: 0 }
  activity.rooms[roomId] = { ...room, entries: room.entries + 1 }
  writeMockActivity(activity)
}

/** 이 기기에서 남긴 사진·한마디만큼 내 사진 수, 오늘 핀 꽃, 내 할 일, 한도를 바꿔 돌려준다 */
export function withMockActivity(home: RoomHome): RoomHome {
  const done = readMockActivity().rooms[home.room.id]
  if (!done) return home
  const me = {
    ...home.me,
    photoCount: (home.me.photoCount ?? 0) + done.photos,
    storyCount: (home.me.storyCount ?? 0) + done.entries,
  }
  const quota = home.room.quota
  return {
    ...home,
    room: quota
      ? {
          ...home.room,
          quota: {
            ...quota,
            myPhotoCount: (quota.myPhotoCount ?? 0) + done.photos,
            myPhotosRemaining: Math.max((quota.myPhotosRemaining ?? 0) - done.photos, 0),
          },
        }
      : home.room,
    me,
    members: home.members.map((m) => (m.id === me.id ? me : m)),
    todayFlowers: [
      ...home.todayFlowers,
      ...Array.from({ length: done.entries }, () => ({ memberId: me.id, flowerCode: me.flowerCode, entryKind: 'FIRST' as const })),
    ],
    myTodo: { ...home.myTodo, needsFirstEntry: home.myTodo.needsFirstEntry && done.entries === 0 },
  }
}
